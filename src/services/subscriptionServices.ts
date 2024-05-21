import { Request, Response } from "express";
import SubscriptionModel from "../models/subscriptionModel";
import { MercadoPagoConfig, Preference } from "mercadopago";
import mercadopago from "mercadopago";

interface IPreference {
  items: {
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
  };
}

const SGetSubscriptionByBusinessID = async ({ params }: Request) => {
  const subscriptionData = await SubscriptionModel.findOne({
    businessID: params.businessID,
  });
  if (!subscriptionData) {
    return "SUBSCRIPTION_NOT_FOUND";
  }
  return subscriptionData;
};
const SGetSubscriptionByOwnerID = async ({ params }: Request) => {
  const subscriptionData = await SubscriptionModel.findOne({
    ownerID: params.ownerID,
  });
  if (!subscriptionData) {
    return "SUBSCRIPTION_NOT_FOUND";
  }
  return subscriptionData;
};

const SCreateMercadoPagoPreference = async (req: Request) => {
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN as string,
  });

  const body = {
    items: [
      {
        id: "SC_FULL_PLAN",
        title: req.body.title,
        quantity: Number(req.body.quantity),
        unit_price: Number(process.env.FULL_PLAN_PRICE),
        currency_id: req.body.currency_id,
      },
    ],
    back_urls: {
      success: `${process.env.FRONTEND_URL}/admin/miempresa/settings`,
      failure: `${process.env.FRONTEND_URL}/failure`,
      pending: `${process.env.FRONTEND_URL}/pending`,
    },
    auto_return: "approved",
    metadata: {
      email: req.body.email,
      businessID: req.body.businessID,
      ownerID: req.body.ownerID,
    },
  };

  try {
    const preference = await new Preference(client).create({ body });
    return preference;
  } catch (error) {
    return "ERROR_POST_MP";
  }
};

const SUpdateSubscriptionPlan = async ({body}: Request) => {
  try {
    const updated = await SubscriptionModel.findOneAndUpdate(
      { businessID: body.business_id },
      body,
      { new: true }
    );
    console.log("updatedSub", updated);
    return updated;
  } catch (error) {
    return "ERROR_UPDATE_SUBSCRIPTION_TYPE";
  }
};

export {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
  SUpdateSubscriptionPlan,
};
