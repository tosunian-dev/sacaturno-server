import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import { SCreateDepositPreference, SDepositWebhook } from "../services/depositServices";

const createDepositPreference = async (req: Request, res: Response) => {
  try {
    const result = await SCreateDepositPreference(req);

    if (typeof result === "string") {
      // Strings son errores semánticos conocidos
      return res.status(400).send({ msg: result });
    }

    res.send(result); // { preferenceID, initPoint }
  } catch (error) {
    handleError(res, "ERROR_DEPOSIT_PREFERENCE");
  }
};

const depositWebhook = async (req: Request, res: Response) => {
  try {
    await SDepositWebhook(req);
    res.status(200).send("OK"); // mp espera 200, si no reintenta
  } catch (error) {
    res.status(200).send("OK"); // nunca devolver codigos 500 al webhook de mp
  }
};

export { createDepositPreference, depositWebhook };