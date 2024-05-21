import axios from "axios";
import {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
} from "../services/subscriptionServices";
import { handleError } from "../utils/error.handle";
import { Request, Response } from "express";
import SubscriptionModel from "../models/subscriptionModel";
import dayjs from "dayjs";

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
      console.log(data.metadata.businessID);
      console.log(data.metadata.business_id);
      
      const paymentDate = dayjs();
      const expiracyDate = paymentDate.add(1, "month");
      if (data.status == "approved") {
        const updatedSubscription = {
          subscriptionType: "SC_FULL",
          paymentDate: paymentDate.toDate(),
          expiracyDate: expiracyDate.toDate(),
        };
        console.log(updatedSubscription)
        const updated= await SubscriptionModel.findOneAndUpdate(
          { businessID: data.metadata.businessID },
          updatedSubscription, {new: true}
        );
        console.log(updated);
        
      }
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
