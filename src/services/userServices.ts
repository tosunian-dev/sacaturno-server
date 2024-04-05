import UserModel from "../models/userModel";
import { encrypt, verify } from "../utils/pwEncrypt.handle";
import { IUser } from "../interfaces/user.interface";
import { Request, Response } from "express";
import { jwtGen } from "../utils/jwtGen.handle";
import { ProfileImage } from "../../../interfaces/profile_image.interface";
import fs from "fs";
import { log } from 'console';

const SCreateUser = async (userData: IUser) => {
  const userExists = await UserModel.find({
    $or: [{ email: userData.email }, { phone: userData.phone }],
  });
  if (userExists.length > 0) {
    return "USER_EXISTS";
  }
  const pwEncrypted = await encrypt(userData.password);
  userData.password = pwEncrypted;
  const createdUser = await UserModel.create(userData);
  return { createdUser, msg: "CHAT_CREATED_SUCCESSFULLY" };
};

const SGetUser = async ({ params }: Request) => {
  const user = await UserModel.find({ _id: params.ID });
  const user_data = user.at(0);
  if (user_data === undefined) {
    return "USER_NOT_FOUND";
  }
  return user_data;
};

const SEditUser = async (req: IUser) => {
  console.log(req);
  
  const editedUser = await UserModel.findOneAndUpdate({ _id: req._id }, req, {
    new: true,
  });
  return editedUser;
};

const SLoginUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const userExists = await UserModel.findOne({ email });
  if (!userExists) {
    return "USER_NOT_FOUND";
  }
  const userID = userExists._id.toString();
  const pwHashed = userExists.password;
  const isPasswordCorrect = await verify(password, pwHashed);
  if (!isPasswordCorrect) {
    return "WRONG_PASSWORD";
  }
  const token = jwtGen(userID);
  const loginData = {
    userID,
    token,
  };
  return loginData;
};

const SUpdateUserProfileImage = async (imageData: {
  path: string;
  userId: string;
}) => {
  const updatedUser = await UserModel.findByIdAndUpdate(imageData.userId, {
    profileImage: imageData.path,
  });
  if (updatedUser?.profileImage !== "user.png") {
    fs.unlink(`profile_images\\${updatedUser?.profileImage}`, async (error) => {
      if (error) {
        return error;
      }
    });
  }
  return updatedUser;
};

export {
  SCreateUser,
  SGetUser,
  SEditUser,
  SLoginUser,
  SUpdateUserProfileImage,
};
