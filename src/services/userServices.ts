import UserModel from "../models/userModel";
import { encrypt, verify } from "../utils/pwEncrypt.handle";
import { IUser } from "../interfaces/user.interface";
import { Request, Response } from "express";
import { jwtGen, verifyToken } from "../utils/jwtGen.handle";
import fs from "fs";
import { Resend } from "resend";
import { buildEmail } from "../utils/emailTemplate";
import { JwtPayload } from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import ServiceModel from "../models/serviceModel";
import BusinessModel from "../models/businessModel";
import EmployeeModel from "../models/employeeModel";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Devuelve todos los roles (owner/employee) que tiene un usuario en el sistema.
// Usado tanto por el login clásico como por el de Google.
const buildUserContexts = async (userID: string) => {
  const contexts: Array<{
    role: string;
    businessID: string;
    businessName: string;
    employeeID?: string;
  }> = [];

  const ownedBusiness = await BusinessModel.findOne({ ownerID: userID }).select(
    "_id name",
  );
  if (ownedBusiness) {
    contexts.push({
      role: "owner",
      businessID: String(ownedBusiness._id),
      businessName: ownedBusiness.name,
    });
  }

  const employees = await EmployeeModel.find({
    userID,
    status: "active",
  }).select("_id businessID");
  for (const employee of employees) {
    const biz = await BusinessModel.findById(employee.businessID).select(
      "name",
    );
    if (biz) {
      contexts.push({
        role: "employee",
        businessID: String(employee.businessID),
        businessName: biz.name,
        employeeID: String(employee._id),
      });
    }
  }

  return contexts;
};

const SCreateUser = async (userData: IUser) => {
  const emailExists = await UserModel.findOne({ email: userData.email });
  if (emailExists) {
    return "USER_EXISTS";
  }
  if (userData.phone) {
    const phoneExists = await UserModel.findOne({ phone: userData.phone });
    if (phoneExists) {
      return "PHONE_EXISTS";
    }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    return "INVALID_EMAIL";
  }
  if (!userData.password) {
    return "MISSING_PASSWORD";
  }
  const pwEncrypted = await encrypt(userData.password);
  userData.password = pwEncrypted;
  const createdUser = await UserModel.create(userData);
  SSendConfirmationEmail(createdUser);
  return { createdUser, msg: "USER_CREATED_SUCCESSFULLY" };
};

const SSendConfirmationEmail = async (userData: IUser) => {
  if (userData._id !== undefined) {
    const token = jwtGen(userData._id.toString());
    const resend = new Resend(process.env.RESEND_KEY);
    // SEND EMAIL WITH RESEND
    const { error } = await resend.emails.send({
      from: "SacaTurno <noresponder@sacaturno.com.ar>",
      to: [userData.email],
      subject: "Confirmá tu cuenta en SacaTurno",
      html: buildEmail({
        previewText: "Activá tu cuenta para continuar con tu registro",
        badge: "Bienvenida",
        bannerTitle: "Bienvenido a SacaTurno",
        greeting: `¡Hola ${userData.name}!`,
        lead: "Te damos la bienvenida a SacaTurno. Para empezar a gestionar tus turnos, necesitamos confirmar que esta cuenta te pertenece.",
        cta: {
          label: "Confirmar cuenta",
          url: `https://sacaturno.com.ar/verify/${token}`,
          style: "solid",
        },
        afterCtaText: "Si no creaste esta cuenta, podés ignorar este correo.",
      }),
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
    { new: true },
  );

  return updatedUser;
};

const SGetUser = async ({ params }: Request) => {
  const user = await UserModel.findOne({ _id: params.ID });
  if (user === null) {
    return "USER_NOT_FOUND";
  }
  return user;
};

const SGetUserByEmail = async ({ params }: Request) => {
  const user = await UserModel.findOne({ email: params.email });
  if (user === null) {
    return "USER_NOT_FOUND";
  }
  return user;
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
  // Cuenta creada solo con Google: no tiene contraseña para el login clásico.
  if (!pwHashed) {
    return "USE_GOOGLE_LOGIN";
  }
  const isPasswordCorrect = await verify(password, pwHashed);
  if (!isPasswordCorrect) {
    return "WRONG_PASSWORD";
  }

  const contexts = await buildUserContexts(userID);
  const token = jwtGen(userID);
  return { userID, token, contexts };
};

const SGoogleAuth = async (credential: string) => {
  if (!credential) {
    return "MISSING_CREDENTIAL";
  }

  // Verificar el ID token contra Google validando que la audiencia sea nuestro client ID.
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    return "INVALID_CREDENTIAL";
  }

  if (!payload || !payload.email || !payload.email_verified) {
    return "INVALID_CREDENTIAL";
  }

  const email = payload.email;
  const googleId = payload.sub;

  let user = await UserModel.findOne({ email });

  if (user) {
    // Vinculación automática: si la cuenta existía (local o Google) y aún no
    // tenía googleId, se lo asociamos. Google ya verificó el email.
    if (!user.googleId) {
      user.googleId = googleId;
      if (user.verified === false) user.verified = true;
      await user.save();
    }
  } else {
    user = await UserModel.create({
      name: payload.given_name || payload.name || "Usuario",
      surname: payload.family_name || "-",
      email,
      googleId,
      authProvider: "google",
      verified: true,
    });
  }

  const userID = user._id.toString();
  const contexts = await buildUserContexts(userID);
  const token = jwtGen(userID);
  return { userID, token, contexts };
};

const SUpdateUserProfileImage = async (imageData: {
  path: string;
  userId: string;
  file_name: string;
}) => {
  const updatedUser = await UserModel.findOneAndUpdate(
    { _id: imageData.userId },
    {
      profileImage: imageData.file_name,
    },
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
    const user = await UserModel.findOne({ _id: params.ownerID });
    if (user) {
      const token = jwtGen(params.ownerID);
      const resend = new Resend(process.env.RESEND_KEY);
      // SEND EMAIL WITH RESEND
      const { error } = await resend.emails.send({
        from: "SacaTurno <noresponder@sacaturno.com.ar>",
        to: [user.email],
        subject: "Restablecé tu contraseña",
        html: buildEmail({
          previewText: "Recuperá el acceso a tu cuenta",
          badge: "Seguridad",
          bannerTitle: "¿Olvidaste tu contraseña?",
          greeting: `¡Hola ${user.name}!`,
          lead: "Recibimos un pedido para restablecer la contraseña de tu cuenta. Creá una nueva desde el botón de acá abajo.",
          cta: {
            label: "Crear nueva contraseña",
            url: `https://sacaturno.com.ar/login/recovery/set/${token}`,
            style: "solid",
          },
          afterCtaText: "Si no fuiste vos, ignorá este mensaje: tu contraseña sigue igual.",
        }),
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
  await UserModel.findOneAndUpdate(
    { _id: userData.userId },
    { password: encryptedPassword },
    { new: true },
  );
};

const SUpdateFirstLoginStatus = async (params: {
  userID: string;
  isFirstLogin: boolean;
}) => {
  const updatedUser = await UserModel.findOneAndUpdate(
    { _id: params.userID },
    { isFirstLogin: params.isFirstLogin },
    { new: true },
  );
  return updatedUser;
};

const SResendConfirmationEmail = async ({ params }: Request) => {
  const user = await UserModel.findOne({ email: params.email });
  if (!user) return "USER_NOT_FOUND";
  if (user.verified) return "USER_ALREADY_VERIFIED";
  await SSendConfirmationEmail(user);
  return "EMAIL_SENT";
};

// Permite a un usuario autenticado que aún no tiene contraseña (típicamente
// cuentas creadas con Google) definir una contraseña de respaldo, para poder
// ingresar con email/contraseña si pierde el acceso a su cuenta de Google.
// Solo aplica cuando la cuenta no tiene contraseña: cambiar una existente se
// hace por el flujo de recuperación (que exige acceso al email).
const SSetBackupPassword = async (userId: string, password: string) => {
  if (!password || password.length < 6) {
    return "INVALID_PASSWORD";
  }
  const user = await UserModel.findById(userId);
  if (!user) {
    return "USER_NOT_FOUND";
  }
  if (user.password) {
    return "PASSWORD_ALREADY_SET";
  }
  user.password = await encrypt(password);
  await user.save();
  return "PASSWORD_SET";
};

// Estado de la contraseña para el panel (nunca expone el hash).
const SGetPasswordStatus = async (userId: string) => {
  const user = await UserModel.findById(userId).select("password authProvider");
  if (!user) {
    return "USER_NOT_FOUND";
  }
  return {
    hasPassword: !!user.password,
    authProvider: user.authProvider ?? "local",
  };
};

const SGetServicesByBusinessID = async ({ params }: Request) => {
  const servicesData = await ServiceModel.find({
    businessID: params.businessID,
  });
  return servicesData;
};

export {
  SCreateUser,
  SGetUser,
  SEditUser,
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
};
