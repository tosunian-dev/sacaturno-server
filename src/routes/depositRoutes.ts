import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import { connectOAuth, oauthCallback, disconnectOAuth } from "../controllers/mpOAuthController";
import { createDepositPreference, depositWebhook } from "../controllers/depositController";

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

export default router;