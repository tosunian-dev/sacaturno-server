import { Request } from "express";
import { MercadoPagoConfig, Preference } from "mercadopago";
import AppointmentModel from "../models/appointmentModel";
import CancelledAppointmentModel from "../models/cancelledAppointmentModel";
import BusinessModel from "../models/businessModel";
import ServiceModel from "../models/serviceModel";
import { SRefreshOAuthToken } from "./mpOAuthServices";
import { SClientEmailBookedAppointment, SBusinessEmailBookedAppointment, SEmployeeEmailBookedAppointment } from "./appointmentServices";
import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import buildPreference from "../utils/preferenceBuilder";
import { SRefundDeposit } from "./refundServices";
import {
    SClientDepositRefundedSlotTaken,
    SBusinessDepositRefundedSlotTaken,
} from "./appointmentServices";

// Reserva temporal del turno mientras el cliente paga. Arranca corta porque solo
// tiene que cubrir el tipeo de la tarjeta, y se extiende si MP avisa que el pago
// quedó pendiente: ahí ya sabemos que hay plata real en juego.
const CHECKOUT_HOLD_MINUTES = 10;
const PENDING_HOLD_MINUTES = 30;

const holdExpiry = (minutes: number) => new Date(Date.now() + minutes * 60_000);

// Crea la preferencia de pago para la seña y devuelve el init_point para redirigir al cliente a MP
const SCreateDepositPreference = async (req: Request) => {
    // datos de la reserva y del cliente
    const { appointmentID, clientName, clientEmail, clientPhone, employeeChosenByClient } = req.body;
    if (!mongoose.isValidObjectId(appointmentID)) return "APPOINTMENT_NOT_FOUND";

    // 1. Obtener el turno
    const appointment = await AppointmentModel.findById(appointmentID);
    if (!appointment) return "APPOINTMENT_NOT_FOUND";

    // 2. Obtener el negocio con tokens (select: false por defecto, hay que pedirlos explícitamente)
    const business = await BusinessModel.findById(appointment.businessID).select(
        "+mpAccessToken +mpRefreshToken"
    );
    if (!business) return "BUSINESS_NOT_FOUND";
    if (business.bookingsEnabled === false) return "BOOKINGS_DISABLED";
    if (!business.mpLinked || !business.mpAccessToken) return "BUSINESS_NOT_LINKED";

    // 3. Obtener el servicio para obtener el monto de la seña (depositAmount)
    const service = await ServiceModel.findOne({
        businessID: appointment.businessID,
        name: appointment.service,
    });
    if (!service) return "SERVICE_NOT_FOUND";
    if (!service.depositAmount || service.depositAmount === 0) return "NO_DEPOSIT_REQUIRED";

    // 4. Tomar la reserva temporal del turno. El findOneAndUpdate condicional es
    // lo que hace segura la concurrencia: si dos clientes salen a pagar el mismo
    // horario a la vez, Mongo resuelve uno solo y el otro no llega a MP.
    const holdUntil = holdExpiry(CHECKOUT_HOLD_MINUTES);
    const now = new Date();
    const claimed = await AppointmentModel.findOneAndUpdate(
        {
            _id: appointmentID,
            status: "unbooked",
            $or: [
                { depositHoldUntil: null },
                { depositHoldUntil: { $lte: now } },
            ],
        },
        {
            depositStatus: "pending",
            depositHoldUntil: holdUntil,
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
            employeeChosenByClient: !!employeeChosenByClient,
        },
        { new: true }
    );

    if (!claimed) {
        // Distinguimos para poder darle un mensaje útil al cliente
        const current = await AppointmentModel.findById(appointmentID).select("status");
        return current?.status === "booked" ? "SLOT_TAKEN" : "SLOT_HELD";
    }

    // Si algo falla creando la preferencia, soltamos el turno enseguida en vez de
    // dejarlo bloqueado los 10 minutos por un error nuestro.
    const releaseClaim = async () => {
        await AppointmentModel.findOneAndUpdate(
            { _id: appointmentID, status: "unbooked", depositStatus: "pending" },
            { depositStatus: "none", depositHoldUntil: null }
        );
    };

    const createFor = async (token: string) => {
        const preference = await buildPreference(
            token,
            appointment._id!.toString(),
            service.depositAmount!,
            service.name,
            business.name,
            clientName,
            clientEmail,
            business.slug,
            holdUntil
        );
        await AppointmentModel.findByIdAndUpdate(appointmentID, {
            mpPreferenceID: preference.id,
        });
        return { preferenceID: preference.id, initPoint: preference.init_point };
    };

    // 5. Intentar con el token actual; si falla por expirado, refrescarlo y reintentar
    try {
        return await createFor(business.mpAccessToken);
    } catch (error: any) {
        // MP devuelve 401 cuando el token expiró
        if (error?.status === 401 || error?.response?.status === 401) {
            const newToken = await SRefreshOAuthToken(appointment.businessID);
            if (typeof newToken !== "string" || newToken.startsWith("NO_")) {
                await releaseClaim();
                return "TOKEN_REFRESH_FAILED";
            }
            try {
                return await createFor(newToken);
            } catch (retryError) {
                await releaseClaim();
                throw retryError;
            }
        }
        await releaseClaim();
        throw error;
    }
};

// Libera la reserva temporal cuando el cliente vuelve del checkout sin pagar.
// Exigimos el preferenceID para que solo pueda soltar el turno quien realmente
// inició ese pago, y no cualquiera que conozca el ID del turno.
const SReleaseDepositHold = async (appointmentID: string, preferenceID: string) => {
    if (!appointmentID || !preferenceID) return "INVALID_PAYLOAD";
    if (!mongoose.isValidObjectId(appointmentID)) return "APPOINTMENT_NOT_FOUND";

    const released = await AppointmentModel.findOneAndUpdate(
        {
            _id: appointmentID,
            mpPreferenceID: preferenceID,
            status: "unbooked",
            depositStatus: "pending",
        },
        { depositStatus: "none", depositHoldUntil: null }
    );
    return released ? "HOLD_RELEASED" : "NOT_RELEASED";
};

// Estado real del turno según nuestra base, para que la pantalla de retorno no
// dependa de lo que MP escribió en la URL.
const SGetDepositStatus = async (appointmentID: string, paymentID?: string) => {
    if (!mongoose.isValidObjectId(appointmentID)) return "APPOINTMENT_NOT_FOUND";
    const appointment = await AppointmentModel.findById(appointmentID).select(
        "status depositStatus mpPaymentID"
    );
    if (!appointment) return "APPOINTMENT_NOT_FOUND";

    // matchesPayment distingue "el turno quedó reservado por vos" de "el turno lo
    // reservó otro". Devolvemos un booleano y no el mpPaymentID ajeno.
    return {
        status: appointment.status,
        depositStatus: appointment.depositStatus ?? "none",
        matchesPayment: Boolean(
            paymentID && appointment.mpPaymentID && appointment.mpPaymentID === paymentID
        ),
    };
};



// Webhook: MP notifica el resultado del pago
const SDepositWebhook = async (req: Request) => {
    const { type, data } = req.body;
    if (!data?.id) return "INVALID_PAYLOAD";

    // MP manda todo a un mismo endpoint y se distingue por "type". Solo nos
    // interesan las notificaciones de pago. Los reembolsos NO son un tipo aparte:
    // llegan como type "payment" con action "payment.updated", y se detectan más
    // abajo consultando el estado del pago. Ignoramos merchant_order, chargebacks,
    // etc. (type ausente = notificación legacy/test → seguimos por compatibilidad).
    if (type && type !== "payment") return `IGNORED_${type}`;

    // Idempotencia: si ya procesamos este paymentID, ignoramos
    const paymentID = data.id.toString();
    const existing = await AppointmentModel.findOne({ mpPaymentID: paymentID });
    if (existing) return "ALREADY_PROCESSED";

    // Consultar el pago en la API de MP 
    const { data: paymentData } = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentID}`,
        {
            headers: {
                Authorization: `Bearer ${process.env.MP_MARKETPLACE_ACCESS_TOKEN}`,
            },
        }
    );

    // Notificación de reembolso: MP marca el pago como "refunded" (total) o deja
    // transaction_amount_refunded > 0 (parcial). Confirmamos el reembolso en el
    // registro de cancelación. Va ANTES del branch "approved" para que un pago
    // reembolsado no se reinterprete como una reserva aprobada.
    const refundedAmount = paymentData.transaction_amount_refunded ?? 0;
    if (paymentData.status === "refunded" || refundedAmount > 0) {
        const cancellation = await CancelledAppointmentModel.findOne({ mpPaymentID: paymentID });
        if (!cancellation) return "NO_CANCELLATION_FOUND";
        if (cancellation.refundStatus === "refunded") return "ALREADY_PROCESSED";

        const refundID = Array.isArray(paymentData.refunds) && paymentData.refunds.length > 0
            ? paymentData.refunds[paymentData.refunds.length - 1].id?.toString() ?? null
            : cancellation.refundID ?? null;

        await CancelledAppointmentModel.findByIdAndUpdate(cancellation._id, {
            refundStatus: "refunded",
            refundID,
            refundAmount: refundedAmount || cancellation.refundAmount,
        });
        return "REFUND_CONFIRMED";
    }

    const appointmentID = paymentData.external_reference;
    if (!appointmentID) return "NO_EXTERNAL_REFERENCE";

    // Actualizar el turno como aprobado
    if (paymentData.status === "approved") {
        // Solo reservamos si el turno sigue libre. El hold hace que esto casi
        // siempre pase, pero no lo garantiza: un webhook demorado o un pendiente
        // que se pasó de los 30 minutos pueden llegar con el horario ya tomado.
        const updatedAppointment = await AppointmentModel.findOneAndUpdate(
            { _id: appointmentID, status: "unbooked" },
            {
                status: "booked",
                depositStatus: "paid",
                mpPaymentID: paymentID,
                title: paymentData.payer?.name ?? "Reservado",
                cancelToken: crypto.randomBytes(24).toString("hex"),
                depositHoldUntil: null,
            },
            { new: true }
        );

        if (!updatedAppointment) {
            return await SRefundUnavailableSlot(appointmentID, paymentID, paymentData);
        }

        const business = await BusinessModel.findById(updatedAppointment.businessID);
        const service = await ServiceModel.findOne({
            businessID: updatedAppointment.businessID,
            name: updatedAppointment.service,
        });
        if (business) {
            const depositAmount = service?.depositAmount ?? 0;
            SClientEmailBookedAppointment(updatedAppointment, business, depositAmount);
            SBusinessEmailBookedAppointment(updatedAppointment, business, depositAmount);
            SEmployeeEmailBookedAppointment(updatedAppointment, business, depositAmount);
        }

        return "PAYMENT_APPROVED";
    }

    // Rechazado: el turno vuelve a estar disponible en el acto, sin esperar a que
    // venza el hold. El filtro por "unbooked" evita pisar un turno que ya es de otro.
    if (paymentData.status === "rejected") {
        await AppointmentModel.findOneAndUpdate(
            { _id: appointmentID, status: "unbooked" },
            {
                depositStatus: "failed",
                mpPaymentID: paymentID,
                depositHoldUntil: null,
            }
        );
        return "PAYMENT_REJECTED";
    }

    // Pendiente: hay plata real en camino, así que le extendemos la reserva del
    // turno. No guardamos el mpPaymentID a propósito: si lo hiciéramos, la guarda
    // de idempotencia de arriba cortaría el webhook de aprobación posterior y el
    // turno nunca llegaría a reservarse.
    await AppointmentModel.findOneAndUpdate(
        { _id: appointmentID, status: "unbooked" },
        {
            depositStatus: "pending",
            depositHoldUntil: holdExpiry(PENDING_HOLD_MINUTES),
        }
    );
    return "PAYMENT_PENDING";
};

// El pago aprobó pero el horario ya no está disponible. Devolvemos la seña y
// avisamos a las dos partes: es el único camino que evita cobrar sin dar turno.
const SRefundUnavailableSlot = async (
    appointmentID: string,
    paymentID: string,
    paymentData: any
) => {
    const appointment = await AppointmentModel.findById(appointmentID);
    if (!appointment) return "APPOINTMENT_NOT_FOUND";

    // Si el turno quedó reservado por este mismo pago, no hay nada que devolver.
    if (appointment.mpPaymentID === paymentID) return "ALREADY_PROCESSED";

    const service = await ServiceModel.findOne({
        businessID: appointment.businessID,
        name: appointment.service,
    });
    const depositAmount = service?.depositAmount ?? 0;

    const result = await SRefundDeposit(
        appointment.businessID,
        paymentID,
        depositAmount
    );
    const refunded = result.status === "refunded";

    // Los datos de contacto del turno ya son del cliente que sí consiguió el
    // horario, así que al que hay que avisarle lo tomamos del pago en MP.
    const payerEmail = paymentData?.payer?.email ?? "";
    const payerName =
        [paymentData?.payer?.first_name, paymentData?.payer?.last_name]
            .filter(Boolean)
            .join(" ") || "Hola";

    const business = await BusinessModel.findById(appointment.businessID);
    if (business) {
        if (payerEmail) {
            SClientDepositRefundedSlotTaken(
                business,
                appointment.start,
                appointment.service,
                depositAmount,
                payerName,
                payerEmail,
                refunded
            );
        }
        SBusinessDepositRefundedSlotTaken(
            business,
            appointment.start,
            appointment.service,
            depositAmount,
            payerName,
            payerEmail,
            refunded
        );
    }

    return refunded ? "SLOT_TAKEN_REFUNDED" : "SLOT_TAKEN_REFUND_FAILED";
};

export {
    SCreateDepositPreference,
    SDepositWebhook,
    SReleaseDepositHold,
    SGetDepositStatus,
};