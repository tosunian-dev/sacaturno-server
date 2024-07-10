import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SCreateUser,
  SEditUser,
  SGetUser,
  SLoginUser,
  SUpdateUserProfileImage,
  SVerifyConfirmToken,
  SSendPasswordRecoveryEmail,
  SUpdatePasswordOnRecovery,
} from "../services/userServices";
import { serialize } from "cookie";
import fs from "fs";
import path from "path";
import { RequestExtended } from "../interfaces/reqExtended.interface";

const loginUser = async ({ body }: Request, res: Response) => {
  try {
    const { email, password } = body;
    const response_data = await SLoginUser({ email, password });
    if (typeof response_data === "object") {
      const serializedToken = serialize("token", response_data.token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30,
        path: "/",
        domain:
          "http://127.0.0.1:3000" ||
          "https://sacaturno.com.ar" ||
          "https://www.sacaturno.com.ar",
      });
      res.setHeader("Set-Cookie", serializedToken);
      res.send({ response_data });
      return;
    }
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_LOGIN");
  }
};

const verifyConfirmToken = async (req: Request, res: Response) => {
  try {
    const response_data = await SVerifyConfirmToken(req);
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_USER_VERIFICATION");
  }
};

const createUser = async ({ body }: Request, res: Response) => {
  try {
    const response_data = await SCreateUser(body);
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_CHAT_CREATION");
  }
};

const editUser = async ({ body }: Request, res: Response) => {
  try {
    const response_data = await SEditUser(body);
    res.send({ response_data, msg: "USER_EDIT_SUCCESFULLY" });
  } catch (error) {
    handleError(res, "ERROR_EDIT_USER");
  }
};

const getUser = async (req: Request, res: Response) => {
  try {
    const response_data = await SGetUser(req);
    res.send({ response_data, msg: "USER_GET_SUCCESSFULLY" });
  } catch (error) {
    handleError(res, "ERROR_GET_USER");
  }
};

const updateUserImage = async (req: RequestExtended, res: Response) => {
  try {
    const { user, file } = req;
    const path: string = `${file?.path}`.split("\\")[4];
    const data = {
      file_name: `${file?.filename}`,
      path,
      userId: `${user?.userId}`,
    };
    const response_data = await SUpdateUserProfileImage(data);
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_UPLOAD_PROFILEPIC");
  }
};

const getProfilePic = async (req: Request, res: Response) => {
  const img = req.params["img"];
  fs.stat("./profile_images/" + img, function (error) {
    if (error) {
      const imagePath = "./profile_images/user.png";
      res.status(200).sendFile(path.resolve(imagePath));
    } else {
      const imagePath = "./profile_images/" + img;
      res.status(200).sendFile(path.resolve(imagePath));
    }
  });
};

const sendPasswordRecoveryEmail = async (req: Request, res: Response) => {
  try {
    const response_data = await SSendPasswordRecoveryEmail(req);
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_SEND_RECOVERY_EMAIL");
  }
};

const updatePasswordOnRecovery = async (req: Request, res: Response) => {
  try {
    const response_data = await SUpdatePasswordOnRecovery(req);
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_SEND_RECOVERY_EMAIL");
  }
};

export {
  getUser,
  createUser,
  editUser,
  updateUserImage,
  loginUser,
  getProfilePic,
  verifyConfirmToken,
  sendPasswordRecoveryEmail,
  updatePasswordOnRecovery,
};
