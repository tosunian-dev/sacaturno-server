import UserModel from "../models/userModel";
import { encrypt, verify } from "../utils/pwEncrypt.handle";
import { IUser } from "../interfaces/user.interface";
import { Request, Response } from "express";
import { jwtGen, verifyToken } from "../utils/jwtGen.handle";
import fs from "fs";
import { Resend } from "resend";
import { JwtPayload } from "jsonwebtoken";
import BusinessModel from "../models/businessModel";

const SCreateUser = async (userData: IUser) => {
  const userExists = await UserModel.find({ email: userData.email });
  if (userExists.length > 0) {
    return "USER_EXISTS";
  }

  const pwEncrypted = await encrypt(userData.password);
  userData.password = pwEncrypted;
  const createdUser = await UserModel.create(userData);

  SSendConfirmationEmail(createdUser);

  return { createdUser, msg: "USER_CREATED_SUCCESSFULLY" };
};

const SSendConfirmationEmail = async (userData: IUser) => {
  if (userData._id !== undefined) {
    const token = jwtGen(userData._id);
    const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
    const { data, error } = await resend.emails.send({
      from: "SacaTurno <noresponder@sacaturno.com.ar>",
      to: [userData.email],
      subject: "Verificá tu cuenta",
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html dir="ltr" lang="en">
      
        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>
        <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Confirmá tu dirección de email en SacaTurno<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
        </div>
      
        <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
            <tbody>
              <tr style="width:100%">
                <td>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                    <tbody style="margin: auto;">
                      <tr>
                        <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                      </tr>
                    </tbody>
                  </table>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                    <tbody>
                      <tr>
                        <td>
                          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                            <tbody style="width:100%">
                              <tr style="width:100%">
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                    <tbody>
                      <tr>
                        <td>
                          <p style="font-size:15px;line-height:1.5;margin:16px 0;font-weight:600;">¡Hola ${userData.name}!,</p>
                          <p style="font-size:14px;line-height:1.5;margin:16px 0;">Para comenzar a utilizar el servicio necesitamos confirmar que tu cuenta pertenece a este correo. Para eso, <b>hacé click en el botón debajo</b> y comenzá a gestionar tus turnos.</p>
                          <div style="width:100%;height:fit-content;display:flex;justify-content:center;margin-top:2.4rem;">
                            <a href="https://sacaturno.com.ar/admin/verify/${token}" target="_blank"  style="margin:auto;background-color: rgb(221, 73, 36);border-radius: 8px;color: rgb(255, 255, 255);display: inline-block;font-size: 12px;font-weight: bold;line-height: 40px;padding: 0px 16px;text-align: center;text-transform: uppercase;text-decoration: none;width: auto;">Confirmar cuenta</a>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
            <tbody>
              <tr>
                <td>
      
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                    <tbody style="width:100%">
                      <tr style="width:100%">
                        <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2024 SacaTurno. Todos los derechos reservados.</p>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      
      </html>`,
    });

    if (error) {
      return console.error({ error });
    }
  }
};

const SVerifyConfirmToken = async ({ params }: Request) => {
  interface tokenResponse extends JwtPayload {
    userId: string;
    iat: number;
    exp: number;
  }
  const verification = verifyToken(params.token);
  const verified = verification as tokenResponse;

  // CAMBIAR VERIFIED A TRUE EN USERMODEL POR EL ID DE VERIFICATION
  const updatedUser = await UserModel.findByIdAndUpdate(
    { _id: verified?.userId },
    {
      verified: true,
    },
    { new: true }
  );

  return updatedUser;
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
  if (userExists.verified === false) {
    return "USER_NOT_VERIFIED";
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
  const updatedUser = await UserModel.findByIdAndUpdate(
    imageData.userId,
    {
      profileImage: imageData.path,
    },
    { new: true }
  );
  if (updatedUser?.profileImage !== "user.png") {
    fs.unlink(`profile_images\\${updatedUser?.profileImage}`, async (error) => {
      if (error) {
        return error;
      }
    });
  }
  return updatedUser;
};

const SSendPasswordRecoveryEmail = async ({ params }: Request) => {
  if (params.ownerID) {
    const business = await BusinessModel.findOne({ ownerID: params.ownerID });
    if (business) {
      const token = jwtGen(params.ownerID);
      const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
      const { data, error } = await resend.emails.send({
        from: "SacaTurno <noresponder@sacaturno.com.ar>",
        to: [business.email],
        subject: "Recuperar contraseña",
        html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html dir="ltr" lang="en">
      
        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>
        <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Restablecé tu contraseña<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
        </div>
      
        <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
            <tbody>
              <tr style="width:100%">
                <td>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                    <tbody style="margin: auto;">
                      <tr>
                        <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                      </tr>
                    </tbody>
                  </table>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                    <tbody>
                      <tr>
                        <td>
                          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                            <tbody style="width:100%">
                              <tr style="width:100%">
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                                <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                    <tbody>
                      <tr>
                        <td>
                          <p style="font-size:15px;line-height:1.5;margin:16px 0;font-weight:600;">Recuperar cuenta</p>
                          <p style="font-size:14px;line-height:1.5;margin:16px 0;">Para restablecer tu contraseña debes <b>hacer click en el botón debajo</b> Luego serás redireccionado a tu panel donde podrás configurar tu nueva contraseña.</p>
                          <div style="width:100%;height:fit-content;display:flex;justify-content:center;margin-top:2.4rem;">
                            <a href="https://sacaturno.com.ar/login/recovery/set/${token}" target="_blank"  style="margin:auto;background-color: rgb(221, 73, 36);border-radius: 8px;color: rgb(255, 255, 255);display: inline-block;font-size: 12px;font-weight: bold;line-height: 40px;padding: 0px 16px;text-align: center;text-transform: uppercase;text-decoration: none;width: auto;">Restablecer contraseña</a>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
            <tbody>
              <tr>
                <td>
      
                  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                    <tbody style="width:100%">
                      <tr style="width:100%">
                        <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2024 SacaTurno. Todos los derechos reservados.</p>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      
      </html>`,
      });
      if (error) {
        return console.error({ error });
      }
    }
  }
};

interface payload extends JwtPayload {
  userId: string;
}

const SUpdatePasswordOnRecovery = async (req: Request) => {
  const userData = verifyToken(req.params.token) as payload;
  const encryptedPassword = await encrypt(req.body.password);
  const updatedUser = await UserModel.findOneAndUpdate(
    { _id: userData.userId },
    { password: encryptedPassword },
    { new: true }
  );
  console.log(updatedUser);
};

export {
  SCreateUser,
  SGetUser,
  SEditUser,
  SLoginUser,
  SUpdateUserProfileImage,
  SVerifyConfirmToken,
  SSendPasswordRecoveryEmail,
  SUpdatePasswordOnRecovery,
};
