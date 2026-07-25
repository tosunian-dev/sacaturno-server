import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import {
  SGetOAuthURL,
  SHandleOAuthCallback,
  SDisconnectOAuth,
} from "../services/mpOAuthServices";

// GET /mp/oauth/connect — el admin llama esto, recibe la URL y redirige al usuario a MP
const connectOAuth = async (req: RequestExtended, res: Response) => {
  try {
    const businessID = req.query.businessID as string;
    if (!businessID) return res.status(400).send({ msg: "MISSING_BUSINESS_ID" });

    const url = await SGetOAuthURL(businessID);
    if (url === "PLAN_REQUIRED") return res.status(402).send({ msg: "PLAN_REQUIRED" });
    res.send({ url });
  } catch (error) {
    handleError(res, "ERROR_OAUTH_CONNECT");
  }
};

// GET /mp/oauth/callback — MP redirige acá con el code y el state (businessID)
const oauthCallback = async (req: Request, res: Response) => {
  const { code, state: businessID, error } = req.query;

  if (error || !code || !businessID) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/admin/account/mercadopago?mp=error`
    );
  }

  try {
    const result = await SHandleOAuthCallback(
      code as string,
      businessID as string
    );

    if (result === "BUSINESS_NOT_FOUND") {
      return res.redirect(
        `${process.env.FRONTEND_URL}/admin/account/mercadopago?mp=error`
      );
    }

    res.redirect(`${process.env.FRONTEND_URL}/admin/account/mercadopago?mp=success`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/admin/account/mercadopago?mp=error`);
  }
};

// DELETE /mp/oauth/disconnect - desvincular la cuenta de MP del negocio
const disconnectOAuth = async (req: RequestExtended, res: Response) => {
  try {
    const businessID = req.query.businessID as string;
    if (!businessID) return res.status(400).send({ msg: "MISSING_BUSINESS_ID" });

    const result = await SDisconnectOAuth(businessID);
    if (result === "BUSINESS_NOT_FOUND")
      return res.status(404).send({ msg: "BUSINESS_NOT_FOUND" });

    res.send({ msg: "DISCONNECTED" });
  } catch (error) {
    handleError(res, "ERROR_OAUTH_DISCONNECT");
  }
};

export { connectOAuth, oauthCallback, disconnectOAuth };