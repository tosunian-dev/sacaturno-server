import { Request, Response } from "express";
import SubscriptionModel from "../models/subscriptionModel";
import { MercadoPagoConfig, Preference } from "mercadopago";
import dayjs from "dayjs";
import PlanPaymentModel from "../models/planPaymentModel";
import { IPlanPayment } from "../interfaces/planPayment.interface";

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
      failure: `${process.env.FRONTEND_URL}/admin/miempresa/settings`,
      pending: `${process.env.FRONTEND_URL}/admin/miempresa/settings`,
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

const SUpdateSubscriptionPlan = async ({ body }: Request) => {
  try {
    const updated = await SubscriptionModel.findOneAndUpdate(
      { businessID: body.businessID },
      {
        paymentDate: body.paymentDate,
        expiracyDate: body.expiracyDate,
        subscriptionType: body.subscriptionType,
        expiracyMonth: dayjs().month() + 2,
        expiracyDay: dayjs().date(),
      },
      { new: true }
    );
    console.log("updatedSub", updated);

    try {
      const now = dayjs().toDate();
      const end = dayjs().endOf('date').toDate() 
      const repeatedPlanPayment = await PlanPaymentModel.find({
        paymentDate: {$gte: now, $lte: end},
        businessID: body.businessID
      });
      if (repeatedPlanPayment.length === 0) {
        const planPayment = await PlanPaymentModel.create({
          price: process.env.FULL_PLAN_PRICE,
          businessID: body.businessID,
          userID: updated?.ownerID,
          paymentDate: body.paymentDate,
          subscriptionType: body.subscriptionType,
          email: body.email,
        });
        return planPayment;
      }
    } catch (error) {
      return "ERROR_CREATE_PLAN_PAYMENT";
    }
    return updated;
  } catch (error) {
    return "ERROR_UPDATE_SUBSCRIPTION_TYPE";
  }
};

const SGetAllPayments = async ({params}:Request) => {  
  try {
    const payments = await PlanPaymentModel.find({userID: params.userID})
    return payments;
  } catch (error) {
    return 'ERROR_GET_PAYMENTS'
  }
}

export {
  SGetSubscriptionByOwnerID,
  SGetSubscriptionByBusinessID,
  SCreateMercadoPagoPreference,
  SUpdateSubscriptionPlan,
  SGetAllPayments
};
