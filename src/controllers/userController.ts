import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SCreateUser,
  SEditUser,
  SGetUser,
  SLoginUser,
  SGoogleAuth,
  SUpdateUserProfileImage,
  SVerifyConfirmToken,
  SSendPasswordRecoveryEmail,
  SUpdatePasswordOnRecovery,
  SGetUserByEmail,
  SUpdateFirstLoginStatus,
  SResendConfirmationEmail,
  SGetServicesByBusinessID,
  SSetBackupPassword,
  SGetPasswordStatus,
} from "../services/userServices";
import { serialize } from "cookie";
import fs from "fs";
import path from "path";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";

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
        domain: process.env.COOKIE_DOMAIN || "sacaturno.com.ar",
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

const googleAuth = async ({ body }: Request, res: Response) => {
  try {
    const { credential } = body;
    const response_data = await SGoogleAuth(credential);
    if (typeof response_data === "object") {
      const serializedToken = serialize("token", response_data.token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30,
        path: "/",
        domain: process.env.COOKIE_DOMAIN || "sacaturno.com.ar",
      });
      res.setHeader("Set-Cookie", serializedToken);
      res.send({ response_data });
      return;
    }
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_GOOGLE_AUTH");
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

const editUser = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const response_data = await SEditUser(user.userId, req.body);
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

const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const response_data = await SGetUserByEmail(req);
    res.send({ response_data, msg: "USER_GET_SUCCESSFULLY" });
  } catch (error) {
    handleError(res, "ERROR_GET_USER");
  }
};

const updateUserImage = async (req: RequestExtended, res: Response) => {
  try {
    const { user, file } = req;
    if (!file?.buffer) {
      return res.status(400).send({ error: "ERROR_NO_IMAGE_PROVIDED" });
    }
    const response_data = await SUpdateUserProfileImage({
      buffer: file.buffer,
      userId: `${user?.userId}`,
    });
    if (response_data === "CLOUDINARY_NOT_CONFIGURED") {
      return handleError(res, "CLOUDINARY_NOT_CONFIGURED");
    }
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

const updateFirstLoginStatus = async (req: Request, res: Response) => {
  try {
    const {userID} = req.params;
    const response_data = await SUpdateFirstLoginStatus({userID, isFirstLogin: false});
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_UPDATE_FIRST_LOGIN_STATUS");
  }
}

const resendConfirmationEmail = async (req: Request, res: Response) => {
  try {
    const response_data = await SResendConfirmationEmail(req);
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_RESEND_CONFIRMATION_EMAIL");
  }
};

const setBackupPassword = async (req: RequestExtended, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).send({ response_data: "NOT_AUTHENTICATED" });
    }
    const { password } = req.body;
    const response_data = await SSetBackupPassword(userId, password);
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_SET_BACKUP_PASSWORD");
  }
};

const getPasswordStatus = async (req: RequestExtended, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).send({ response_data: "NOT_AUTHENTICATED" });
    }
    const response_data = await SGetPasswordStatus(userId);
    res.send({ response_data });
  } catch (error) {
    handleError(res, "ERROR_GET_PASSWORD_STATUS");
  }
};

const getServicesByBusinessID = async (req: Request, res: Response) => {
  try {
    const servicesData = await SGetServicesByBusinessID(req);
    if (!servicesData) {
      return res.send("SERVICES_NOT_FOUND");
    }
    res.send(servicesData);
  } catch (error) {
    handleError(res, "ERROR_GET_SERVICES");
  }
};

export {
  getUser,
  createUser,
  editUser,
  updateUserImage,
  loginUser,
  getProfilePic,
  googleAuth,
  verifyConfirmToken,
  sendPasswordRecoveryEmail,
  updatePasswordOnRecovery,
  getUserByEmail,
  updateFirstLoginStatus,
  resendConfirmationEmail,
  getServicesByBusinessID,
  setBackupPassword,
  getPasswordStatus,
};
