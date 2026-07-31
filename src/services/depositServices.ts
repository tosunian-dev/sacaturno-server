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
import buildPreference from "../utils/preferenceBuilder";

// Crea la preferencia de pago para la seña y devuelve el init_point para redirigir al cliente a MP
const SCreateDepositPreference = async (req: Request) => {
    // datos de la reserva y del cliente 
    const { appointmentID, clientName, clientEmail, clientPhone } = req.body;

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

    // 4. Intentar con el token actual; si falla por expirado, refrescarlo y reintentar
    let accessToken = business.mpAccessToken;
    try {
        const preference = await buildPreference(
            accessToken,
            appointment._id!.toString(),
            service.depositAmount,
            service.name,
            business.name,
            clientName,
            clientEmail
        );

        // Guardar el preferenceID en el turno y marcarlo como pendiente de pago
        await AppointmentModel.findByIdAndUpdate(appointmentID, {
            depositStatus: "pending",
            mpPreferenceID: preference.id,
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
        });

        return { preferenceID: preference.id, initPoint: preference.init_point };
    } catch (error: any) {
        // MP devuelve 401 cuando el token expiró
        if (error?.status === 401 || error?.response?.status === 401) {
            // refrescar el token y reintentar
            const newToken = await SRefreshOAuthToken(appointment.businessID);
            if (typeof newToken !== "string" || newToken.startsWith("NO_")) return "TOKEN_REFRESH_FAILED";

            const preference = await buildPreference(
                newToken,
                appointment._id!.toString(),
                service.depositAmount,
                service.name,
                business.name,
                clientName,
                clientEmail
            );

            await AppointmentModel.findByIdAndUpdate(appointmentID, {
                depositStatus: "pending",
                mpPreferenceID: preference.id,
                name: clientName,
                email: clientEmail,
                phone: clientPhone,
            });

            return { preferenceID: preference.id, initPoint: preference.init_point };
        }
        throw error;
    }
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
        const updatedAppointment = await AppointmentModel.findByIdAndUpdate(
            appointmentID,
            {
                status: "booked",
                depositStatus: "paid",
                mpPaymentID: paymentID,
                title: paymentData.payer?.name ?? "Reservado",
                cancelToken: crypto.randomBytes(24).toString("hex"),
            },
            { new: true }
        );

        if (updatedAppointment) {
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
        }

        return "PAYMENT_APPROVED";
    }

    // Actualizar el turno como rechazado
    if (paymentData.status === "rejected") {
        await AppointmentModel.findByIdAndUpdate(appointmentID, {
            depositStatus: "failed",
            mpPaymentID: paymentID,
        });
        return "PAYMENT_REJECTED";
    }

    // para otro estado de pago (ej. pending), turno queda como "pending" para que el negocio revise el pago manualmente en su cuenta mp
    return "PAYMENT_PENDING";
};

export { SCreateDepositPreference, SDepositWebhook };