import { IBusiness } from "../interfaces/business.interface";
import BusinessModel from "../models/businessModel";
import { Request, Response } from "express";
import fs from "fs";

const SCreateBusiness = async (businessData: IBusiness) => {
  const businessExists = await BusinessModel.find({
    $or: [{ ownerID: businessData.ownerID }, { name: businessData.name }],
  });
  if (businessExists.length > 0) {
    return "BUSINESS_EXISTS";
  }
  const createdBusiness = await BusinessModel.create(businessData);
  return createdBusiness;
};

const SGetBusinessByOwnerID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ ownerID: params.ownerID });
  return businessData;
};

const SEditBusinessData = async (businessData: IBusiness) => {
  const editedBusiness = await BusinessModel.findByIdAndUpdate(
    { _id: businessData._id },
    businessData,
    { new: true }
  );
  if (editedBusiness === null) {
    return "BUSINESS_NOT_FOUND";
  }

  return editedBusiness;
};

const SUpdateBusinessImage = async (imageData: {
  path: string;
  userId: string;
}) => {


  const updatedBusiness = await BusinessModel.findOneAndUpdate(
    { ownerID: imageData.userId },
    { image: imageData.path }
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

export {
  SCreateBusiness,
  SGetBusinessByOwnerID,
  SEditBusinessData,
  SUpdateBusinessImage,
};
