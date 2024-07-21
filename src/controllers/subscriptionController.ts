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
import SubscriptionModel from "../models/subscriptionModel";
import dayjs from "dayjs";
import PlanPaymentModel from "../models/planPaymentModel";

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

const createMercadoPagoPreference = async (req: Request, res: Response) => {
  try {
    const preferenceData = await SCreateMercadoPagoPreference(req);
    if (!preferenceData) {
      return res.send("ERROR_PREFERENCE_CREATION");
    }
    res.send(preferenceData);
  } catch (error) {
    handleError(res, "ERROR_GET_SUBSCRIPTION");
  }
};

const paymentWebhook = async (req: Request, res: Response) => {
  const paymentInfo = req.body;
  try {
    const paymentExists = await PlanPaymentModel.find({
      mpPaymentID: paymentInfo.data.id,
    });
    if (paymentExists.length > 0) {
      console.log("MP Webhook: payment is duplicated;", paymentExists);
      return;
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
          console.log("STATUS WEBHOOK", data.status);
          console.log("mpPaymentID", paymentInfo.data.id);
          const paymentDate = dayjs();
          const expiracyDate = paymentDate.add(1, "month");
          if (data.status === "approved") {
            const updatedSubscription = {
              userID: data.metadata.owner_id,
              email: data.metadata.email,
              businessID: data.metadata.business_id,
              subscriptionType: "SC_FULL",
              paymentDate: paymentDate.toDate(),
              expiracyDate: expiracyDate.toDate(),
              mpPaymentID: paymentInfo.data.id,
            };

            await axios
              .put(
                `${process.env.BACKEND_URL}/subscription/update`,
                updatedSubscription
              )
              .then((data) => {
                console.log("updatesubresponse", data.data);
              });
          }
        })
        .catch((error: any) => {
          console.log("duplicated MP request");
        });
    }
  } catch (error) {}
};

const updateSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const update = await SUpdateSubscriptionPlan(req);
    return update;
  } catch (error) {
    handleError(res, "ERROR_UPDATE_SUBSCRIPTION");
  }
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
  updateSubscriptionPlan,
  getAllPayments,
};
