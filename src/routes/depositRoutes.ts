import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import { connectOAuth, oauthCallback, disconnectOAuth } from "../controllers/mpOAuthController";
import {
  createDepositPreference,
  depositWebhook,
  releaseDepositHold,
  getDepositStatus,
} from "../controllers/depositController";

const router = Router();

// OAuth

// conectar cuenta mp del negocio (redirect a mp)
router.get("/mp/oauth/connect", checkAuth, connectOAuth);
// redirect de MP al conectar la cuenta
router.get("/mp/oauth/callback", oauthCallback);
// desvincular cuenta mp del negocio
router.delete("/mp/oauth/disconnect", checkAuth, disconnectOAuth);


// Señas

// crear preferencia para seña de turno
router.post("/mp/deposit/create-preference", createDepositPreference);
// webhook mp para actualizar estado de la seña cuando se paga/rechaza/etc en mp
router.post("/mp/deposit/webhook", depositWebhook);
// libera la reserva temporal cuando el cliente vuelve de mp sin pagar
router.post("/mp/deposit/release-hold", releaseDepositHold);
// estado real del turno segun nuestra base, para la pantalla de retorno
router.get("/mp/deposit/status/:appointmentID", getDepositStatus);

export default router;