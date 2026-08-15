import axios from "axios";
import {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
  SUpdateSubscriptionPlan,
  SGetAllPayments,
} from "../services/subscriptionServices";
import { handleError } from "../utils/error.handle";
import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import SubscriptionModel from "../models/subscriptionModel";
import BusinessModel from "../models/businessModel";
import dayjs from "dayjs";
import PlanPaymentModel from "../models/planPaymentModel";
import { isPaidPlan } from "../config/planLimits";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";
import { verifyMercadoPagoSignature } from "../utils/mpSignature";

const getSubscriptionByBusinessID = async (req: Request, res: Response) => {
  try {
    const subscriptionData = await SGetSubscriptionByBusinessID(req);
    if (!subscriptionData) {
      return res.send("SUBSCRIPTION_NOT_FOUND");
    }
    res.send(subscriptionData);
  } catch (error) {
    handleError(res, "ERROR_GET_SUBSCRIPTION");
  }
};

const getSubscriptionByOwnerID = async (req: Request, res: Response) => {
  try {
    const subscriptionData = await SGetSubscriptionByOwnerID(req);
    if (!subscriptionData) {
      return res.send("SUBSCRIPTION_NOT_FOUND");
    }
    res.send(subscriptionData);
  } catch (error) {
    handleError(res, "ERROR_GET_SUBSCRIPTION");
  }
};

const createMercadoPagoPreference = async (req: RequestExtended, res: Response) => {
  try {
    // Identidad y monto vienen del token + la base, nunca del body: así el
    // cliente no puede crear una preferencia a nombre de otro dueño/negocio.
    const user = req.user as JwtContextPayload;
    const ownerID = user?.userId;
    if (!ownerID) return res.status(401).send("NOT_AUTHENTICATED");

    const { businessID } = req.body;
    if (!isValidObjectId(businessID)) return res.status(400).send("INVALID_BUSINESS");

    const business = await BusinessModel.findOne({ _id: businessID, ownerID }).select("_id email");
    if (!business) return res.status(403).send("FORBIDDEN");

    const preferenceData = await SCreateMercadoPagoPreference(req, {
      ownerID,
      businessID: String(business._id),
      email: business.email,
    });
    if (preferenceData === "INVALID_PLAN") {
      return res.status(400).send("INVALID_PLAN");
    }
    if (!preferenceData) {
      return res.send("ERROR_PREFERENCE_CREATION");
    }
    res.send(preferenceData);
  } catch (error) {
    handleError(res, "ERROR_GET_SUBSCRIPTION");
  }
};

const paymentWebhook = async (req: Request, res: Response) => {
  // Rechazamos de entrada toda notificación cuya firma no valide: sin esto,
  // cualquiera que conozca un payment.id puede disparar el webhook.
  if (!verifyMercadoPagoSignature(req, process.env.MP_WEBHOOK_SECRET, "subscription webhook")) {
    return res.status(401).send("INVALID_SIGNATURE");
  }

  const paymentInfo = req.body;

  try {
    if (!paymentInfo?.data?.id) return res.status(200).send("OK");
    const paymentExists = await PlanPaymentModel.find({
      mpPaymentID: paymentInfo.data.id,
    });
    if (paymentExists.length > 0) {
      console.log("MP Webhook: payment is duplicated;", paymentExists);
      return res.status(200).send('OK')
    } else {
      // GET PAYMENT INFO BY ID //
      axios
        .get("https://api.mercadopago.com/v1/payments/" + paymentInfo.data.id, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          },
        })
        .then(async (response) => {
          const { data } = response;
          //console.log(data.metadata);
          //console.log('businessID',data.metadata.businessID);
          //console.log('business_id',data.metadata.business_id);
          const paymentDate = dayjs();
          const expiracyDate = paymentDate.add(1, "month");
          if (data.status === "approved") {
            // MP normaliza las claves de metadata a snake_case al devolverlas
            const targetPlan = data.metadata?.target_plan;
            if (!isPaidPlan(targetPlan)) {
              console.log("MP Webhook: falta o es inválido target_plan en metadata", data.metadata);
              return;
            }
            const updatedSubscription = {
              email: data.metadata.email,
              businessID: data.metadata.business_id,
              subscriptionType: targetPlan,
              paymentDate: paymentDate.toDate(),
              expiracyDate: expiracyDate.toDate(),
              mpPaymentID: paymentInfo.data.id,
              amountPaid: data.transaction_amount,
            };
            // Llamada directa en proceso: antes era un PUT HTTP a
            // /subscription/update, una ruta pública que permitía a cualquiera
            // asignarse un plan sin pagar. Al invocar el servicio acá, esa ruta
            // deja de existir y se cierra el bypass de monetización.
            await SUpdateSubscriptionPlan(updatedSubscription);
          }
        })
        .catch((error: any) => {
          console.log("duplicated MP request");
        });
    }
  } catch (error) {}
  return res.status(200).send('OK')
};

const getAllPayments = async (req: Request, res: Response) => {
  try {
    const payments = await SGetAllPayments(req);
    return res.send(payments);
  } catch (error) {
    handleError(res, "ERROR_UPDATE_SUBSCRIPTION");
  }
};

export {
  getSubscriptionByOwnerID,
  getSubscriptionByBusinessID,
  createMercadoPagoPreference,
  paymentWebhook,
  getAllPayments,
};
