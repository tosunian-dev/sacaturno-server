import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SCreateDepositPreference,
  SDepositWebhook,
  SReleaseDepositHold,
  SGetDepositStatus,
} from "../services/depositServices";
import { verifyMercadoPagoSignature } from "../utils/mpSignature";

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
  // Firma inválida = no es MP. Rechazamos antes de tocar la base o consultar la
  // API de pagos. Usa el secreto del webhook de la app marketplace (señas).
  if (
    !verifyMercadoPagoSignature(
      req,
      process.env.MP_MARKETPLACE_WEBHOOK_SECRET,
      "deposit webhook"
    )
  ) {
    return res.status(401).send("INVALID_SIGNATURE");
  }
  try {
    await SDepositWebhook(req);
    res.status(200).send("OK"); // mp espera 200, si no reintenta
  } catch (error) {
    res.status(200).send("OK"); // nunca devolver codigos 500 al webhook de mp
  }
};

// Llamado desde el navegador cuando el cliente vuelve de MP sin haber pagado:
// libera el turno enseguida en vez de esperar a que venza la reserva temporal.
const releaseDepositHold = async (req: Request, res: Response) => {
  try {
    const { appointmentID, preferenceID } = req.body;
    const result = await SReleaseDepositHold(appointmentID, preferenceID);
    res.send({ msg: result });
  } catch (error) {
    handleError(res, "ERROR_RELEASE_HOLD");
  }
};

const getDepositStatus = async (req: Request, res: Response) => {
  try {
    const paymentID =
      typeof req.query.paymentID === "string" ? req.query.paymentID : undefined;
    const result = await SGetDepositStatus(req.params.appointmentID, paymentID);
    if (typeof result === "string") {
      return res.status(404).send({ msg: result });
    }
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_GET_DEPOSIT_STATUS");
  }
};

export {
  createDepositPreference,
  depositWebhook,
  releaseDepositHold,
  getDepositStatus,
};