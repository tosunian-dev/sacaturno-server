import { Request, Response } from "express";
import SubscriptionModel from "../models/subscriptionModel";
import { MercadoPagoConfig, Preference } from "mercadopago";
import PlanPaymentModel from "../models/planPaymentModel";
import { getPlanPrice, isPaidPlan, PLAN_LABELS } from "../config/planLimits";

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
  const targetPlan = req.body.targetPlan;
  if (!isPaidPlan(targetPlan)) return "INVALID_PLAN";

  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCESS_TOKEN as string,
  });

  const body = {
    items: [
      {
        id: `${targetPlan}_PLAN`,
        title: PLAN_LABELS[targetPlan],
        quantity: Number(req.body.quantity),
        unit_price: getPlanPrice(targetPlan),
        currency_id: req.body.currency_id,
      },
    ],
    back_urls: {
      success: `${process.env.FRONTEND_URL}/admin/account/subscription`,
      failure: `${process.env.FRONTEND_URL}/admin/account/subscription`,
      pending: `${process.env.FRONTEND_URL}/admin/account/subscription`,
    },
    auto_return: "approved",
    metadata: {
      email: req.body.email,
      businessID: req.body.businessID,
      ownerID: req.body.ownerID,
      targetPlan,
    },
    external_reference: req.body.ownerID,
    notification_url: "https://sacaturno-server-production.up.railway.app/api/subscription/webhook"
  };

  try {
    const preference = await new Preference(client).create({ body });
    return preference;
  } catch (error) {
    return "ERROR_POST_MP";
  }
};

const SUpdateSubscriptionPlan = async ({ body }: Request) => {
  try {
    const updated = await SubscriptionModel.findOneAndUpdate(
      { businessID: body.businessID },
      {
        paymentDate: body.paymentDate,
        expiracyDate: body.expiracyDate,
        subscriptionType: body.subscriptionType,
      },
      { new: true }
    );
    try {
      const planPayment = await PlanPaymentModel.create({
        price:
          body.amountPaid ??
          (isPaidPlan(body.subscriptionType)
            ? getPlanPrice(body.subscriptionType)
            : 0),
        businessID: body.businessID,
        userID: updated?.ownerID,
        paymentDate: body.paymentDate,
        subscriptionType: body.subscriptionType,
        email: body.email,
        mpPaymentID: body.mpPaymentID,
      });
      return planPayment;
    } catch (error) {
      return "ERROR_CREATE_PLAN_PAYMENT";
    }
  } catch (error) {
    return "ERROR_UPDATE_SUBSCRIPTION_TYPE";
  }
};

const SGetAllPayments = async ({ params }: Request) => {
  try {
    const payments = await PlanPaymentModel.find({
      userID: params.userID,
    }).sort({ createdAt: -1 });
    return payments;
  } catch (error) {
    return "ERROR_GET_PAYMENTS";
  }
};

export {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
  SUpdateSubscriptionPlan,
  SGetAllPayments,
};
