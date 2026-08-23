import UserModel from "../models/userModel";
import { encrypt, verify, needsRehash } from "../utils/pwEncrypt.handle";
import { IUser } from "../interfaces/user.interface";
import { Request, Response } from "express";
import { jwtGen, verifyToken } from "../utils/jwtGen.handle";
import {
  uploadImage,
  deleteImage,
  isCloudinaryConfigured,
} from "../config/cloudinary";
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

  // El registro del dueño como prestador no es un contexto de empleado: sin
  // este filtro el selector le ofrecería entrar dos veces a su propio negocio.
  const employees = await EmployeeModel.find({
    userID,
    status: "active",
    isOwner: { $ne: true },
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
  // Guard anti-inyección NoSQL: email/password deben ser strings antes de tocar la
  // base (findOne) o bcrypt. Si llega un objeto ({"$ne":null}), Mongo lo tomaría
  // como operador.
  if (typeof userData?.email !== "string" || typeof userData?.password !== "string") {
    return "INVALID_EMAIL";
  }
  const emailExists = await UserModel.findOne({ email: userData.email });
  if (emailExists) {
    return "USER_EXISTS";
  }
  const phoneIsScalar =
    typeof userData.phone === "number" || typeof userData.phone === "string";
  if (userData.phone && phoneIsScalar) {
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
  // Whitelist explícita de campos: NUNCA se confía en el body para `verified`,
  // `authProvider`, `googleId`, `_id`, etc. Registrarse con { verified: true }
  // saltearía la confirmación por email; { _id } permitiría fijar el propio id.
  // `verified` (false) y `authProvider` ("local") toman el default del schema.
  const createData: Record<string, unknown> = {
    name: userData.name,
    surname: userData.surname,
    email: userData.email,
    password: pwEncrypted,
  };
  if (phoneIsScalar) {
    createData.phone = userData.phone;
  }
  const createdUser = await UserModel.create(createData);
  SSendConfirmationEmail(createdUser as unknown as IUser);
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
  // Endpoint PÚBLICO (lo usa el flujo de recuperación de contraseña, que solo
  // necesita el _id). Devolver el documento entero filtraba el hash de la
  // contraseña y toda la PII del usuario.
  const user = await UserModel.findOne({ email: params.email }).select("_id");
  if (user === null) {
    return "USER_NOT_FOUND";
  }
  return { _id: user._id };
};

const SEditUser = async (
  userId: string,
  body: { name?: unknown; surname?: unknown; phone?: unknown }
) => {
  // El id sale del token (checkAuth), NUNCA del body: antes se usaba `req._id`,
  // así que pasando otro _id se editaba a otro usuario (IDOR).
  // Whitelist explícita: el perfil solo edita name/surname/phone. Pasar el body
  // entero permitía mass assignment (verified, password, email, authProvider…).
  const allowedFields: Record<string, unknown> = {};
  if (typeof body?.name === "string") allowedFields.name = body.name;
  if (typeof body?.surname === "string") allowedFields.surname = body.surname;
  if (typeof body?.phone === "number" || typeof body?.phone === "string") {
    allowedFields.phone = body.phone;
  }
  const editedUser = await UserModel.findByIdAndUpdate(
    userId,
    { $set: allowedFields },
    { new: true }
  );
  return editedUser;
};

const SLoginUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  // Defensa contra inyección de operadores NoSQL: si el body manda `email` o
  // `password` como objeto (p.ej. {"$ne":null}), Mongo los interpretaría como
  // operadores de query. Exigimos strings; si no, cortamos como credencial inválida.
  if (typeof email !== "string" || typeof password !== "string") {
    return "USER_NOT_FOUND";
  }
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

  // Rehash progresivo: sube al cost factor actual las passwords hasheadas con
  // uno viejo. Si falla, el login sigue igual — es una mejora, no un requisito.
  if (needsRehash(pwHashed)) {
    try {
      userExists.password = await encrypt(password);
      await userExists.save();
    } catch (error) {
      console.error("Password rehash failed for user", userID, error);
    }
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
  buffer: Buffer;
  userId: string;
}) => {
  if (!isCloudinaryConfigured()) {
    return "CLOUDINARY_NOT_CONFIGURED";
  }

  const uploaded = await uploadImage(imageData.buffer);

  // findOneAndUpdate sin `new` devuelve el documento previo, que es justo lo que
  // hace falta para saber qué imagen vieja hay que borrar.
  const previousUser = await UserModel.findOneAndUpdate(
    { _id: imageData.userId },
    {
      profileImage: uploaded.url,
      profileImagePublicId: uploaded.publicId,
    },
  );

  await deleteImage(previousUser?.profileImagePublicId);

  return await UserModel.findOne({ _id: imageData.userId });
};

const SSendPasswordRecoveryEmail = async ({ params }: Request) => {
  if (params.ownerID) {
    const user = await UserModel.findOne({ _id: params.ownerID });
    if (user) {
      // Vida corta: el link de reseteo caduca en 1 hora, no en los 30 días
      // por defecto. Reduce la ventana si el email se filtra o queda expuesto.
      const token = jwtGen(params.ownerID, "1h");
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
  const { password } = req.body;
  if (typeof password !== "string" || password.length < 6) {
    return "INVALID_PASSWORD";
  }

  // verifyToken lanza si el token está vencido o adulterado. Con la vida corta
  // del link (1h) eso ahora es un caso esperado, no un bug: lo atrapamos y
  // devolvemos un error controlado en vez de un 500 con stack trace.
  let userData: payload;
  try {
    userData = verifyToken(req.params.token) as payload;
  } catch (error) {
    return "INVALID_OR_EXPIRED_TOKEN";
  }

  const encryptedPassword = await encrypt(password);
  await UserModel.findOneAndUpdate(
    { _id: userData.userId },
    { password: encryptedPassword },
    { new: true },
  );
  return "PASSWORD_UPDATED";
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
