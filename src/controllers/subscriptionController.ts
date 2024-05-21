import axios from "axios";
import {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
} from "../services/subscriptionServices";
import { handleError } from "../utils/error.handle";
import { Request, Response } from "express";

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
      console.log(data.metadata);
      
    })
    .catch((error: any) => {
      console.log(error);
    });
};

export {
  getSubscriptionByOwnerID,
  getSubscriptionByBusinessID,
  createMercadoPagoPreference,
  paymentWebhook,
};
