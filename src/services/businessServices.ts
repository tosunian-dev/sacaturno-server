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
  console.log('imagedata: ', imageData);
  

  const updatedBusiness = await BusinessModel.findOneAndUpdate(
    { ownerID: imageData.userId },
    { image: imageData.path },
    { new: true }
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
  const regex = new RegExp(params.name, 'i');
  const businessData = await BusinessModel.find({ name: regex });
  if(businessData.length === 0){
    return "BUSINESS_NOT_FOUND"
  }
  return businessData;
};

const SGetBusinessByID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ _id: params.ID });
  return businessData;
};

export {
  SCreateBusiness,
  SGetBusinessByOwnerID,
  SEditBusinessData,
  SUpdateBusinessImage,
  SGetBusinessByName,
  SGetBusinessByID
};
