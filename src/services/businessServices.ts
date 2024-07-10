import { IBusiness } from "../interfaces/business.interface";
import { IService } from "../interfaces/service.interface";
import BusinessModel from "../models/businessModel";
import { Request } from "express";
import fs from "fs";
import ServiceModel from "../models/serviceModel";
import dayjs from "dayjs";
import ISubscription from "../interfaces/subscription.interface";
import SubscriptionModel from "../models/subscriptionModel";
import PlanPaymentModel from "../models/planPaymentModel";
import { IPlanPayment } from "../interfaces/planPayment.interface";

const SCreateBusiness = async (businessData: IBusiness) => {
  // CHECK IF BUSINESS EXISTS
  const businessExists = await BusinessModel.find({
    $or: [{ ownerID: businessData.ownerID }, { name: businessData.name }],
  });
  if (businessExists.length > 0) {
    return "BUSINESS_EXISTS";
  }
  // CREATE BUSINESS
  const createdBusiness = await BusinessModel.create(businessData);

  // CREATE FREE SUBSCRIPTION DETAILS

  // FOR 1 MONTH FREE TRIAL
  // const paymentDate = dayjs();
  // const expiracyDate = paymentDate.add(1, "month");

  const paymentDate = dayjs();
  const expDate = paymentDate.add(15, "day");

  const subDetails: ISubscription = {
    ownerID: businessData.ownerID,
    businessID: createdBusiness._id,
    subscriptionType: "SC_FREE",
    paymentDate: paymentDate.toDate(),
    expiracyDate: expDate.toDate(),
    expiracyMonth: dayjs(expDate).month(),
    expiracyDay: dayjs(expDate).date(),
  };
  const subscriptionDetails = await SubscriptionModel.create(subDetails);
  const planPayment: IPlanPayment = await PlanPaymentModel.create({
    price: 0,
    businessID: createdBusiness._id,
    userID: businessData.ownerID,
    paymentDate: paymentDate.toDate(),
    subscriptionType: "SC_FREE",
    mpPaymentID: "",
    email: createdBusiness.email,
  });
  return { createdBusiness, subscriptionDetails };
};

const SGetBusinessByOwnerID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ ownerID: params.ownerID });
  return businessData;
};

const SEditBusinessData = async (businessData: IBusiness) => {
  const slugExists = await BusinessModel.find({ slug: businessData.slug });
  if (
    slugExists.length === 0 ||
    slugExists[0]._id.toString() === businessData._id
  ) {
    const editedBusiness = await BusinessModel.findByIdAndUpdate(
      { _id: businessData._id },
      businessData,
      { new: true }
    );
    if (editedBusiness === null) {
      return "BUSINESS_NOT_FOUND";
    }
    return editedBusiness;
  } else {
    return "ERROR_EDIT_SLUG_EXISTS";
  }
};

const SUpdateBusinessImage = async (imageData: {
  path: string;
  userId: string;
  file_name: string;
}) => {
  const updatedBusiness = await BusinessModel.findOneAndUpdate(
    { ownerID: imageData.userId },
    { image: imageData.file_name }
  );
  if (updatedBusiness?.image !== "user.png") {
    fs.unlink(`profile_images\\${updatedBusiness?.image}`, async (error) => {
      if (error) {
        return error;
      }
    });
  }
  return updatedBusiness;
};

const SGetBusinessByName = async ({ params }: Request) => {
  const regex = new RegExp(params.name, "i");
  const businessData = await BusinessModel.find({ name: regex });
  if (businessData.length === 0) {
    return "BUSINESS_NOT_FOUND";
  }
  return businessData;
};

const SGetBusinessByID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ _id: params.ID });
  return businessData;
};

const SGetBusinessBySlug = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ slug: params.slug });
  return businessData;
};

const SGetBusinessByEmail = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ email: params.email });
  return businessData;
};

const SGetServicesByBusinessID = async ({ params }: Request) => {
  const servicesData = await ServiceModel.find({
    businessID: params.businessID,
  });
  return servicesData;
};

const SGetServicesByOwnerID = async ({ params }: Request) => {
  const servicesData = await ServiceModel.find({ ownerID: params.ownerID });
  return servicesData;
};

const SCreateService = async (serviceData: IService) => {
  const serviceExists = await ServiceModel.find({ ownerID: serviceData.name });
  if (serviceExists.length > 0) {
    return "SERVICE_EXISTS";
  }
  const createdBusiness = await ServiceModel.create(serviceData);
  return createdBusiness;
};

const SDeleteService = async ({ params }: Request) => {
  const serviceData = await ServiceModel.findByIdAndDelete(params.serviceID);
};

const SEditServiceData = async (serviceData: {
  id: string;
  name: string;
  description: string;
  price: number;
}) => {
  const editedService = await ServiceModel.findByIdAndUpdate(
    { _id: serviceData.id },
    serviceData,
    { new: true }
  );
  if (editedService) return editedService;
  if (editedService === null) {
    return "SERVICE_NOT_FOUND";
  }
};

export {
  SCreateBusiness,
  SGetBusinessByOwnerID,
  SEditBusinessData,
  SUpdateBusinessImage,
  SGetBusinessByName,
  SGetBusinessByID,
  SCreateService,
  SDeleteService,
  SGetServicesByBusinessID,
  SGetServicesByOwnerID,
  SGetBusinessBySlug,
  SGetBusinessByEmail,
  SEditServiceData,
};
