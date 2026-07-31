import axios from "axios";
import { Request } from "express";
import BusinessModel from "../models/businessModel";
import SubscriptionModel from "../models/subscriptionModel";
import { getPlanLimits } from "../config/planLimits";

const MP_OAUTH_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

// Genera la URL de autorización de MP
// el usuario es redirigido acá para vincular su cuenta con la app
// appName: (SacaTurno - Reservas)
const SGetOAuthURL = async (businessID: string): Promise<string | "PLAN_REQUIRED"> => {
    const subscription = await SubscriptionModel.findOne({ businessID });
    if (!getPlanLimits(subscription?.subscriptionType).depositsEnabled) return "PLAN_REQUIRED";

    const params = new URLSearchParams({
        client_id: process.env.MP_MARKETPLACE_CLIENT_ID as string,
        response_type: "code",
        platform_id: "mp",
        redirect_uri: process.env.MP_OAUTH_REDIRECT_URI as string,
        state: businessID, // lo recuperamos en el oauth callback handler para saber a qué negocio vincular
    });
    return `${MP_OAUTH_URL}?${params.toString()}`;
};

// Intercambia el code de MP por access_token + refresh_token y los guarda en el Business
const SHandleOAuthCallback = async (code: string, businessID: string) => {
    // Si el code es valido, MP devuelve access_token (para usar su API) y refresh_token (para renovar el access_token sin que el usuario vuelva a autorizar)
    const { data } = await axios.post(
        MP_TOKEN_URL,
        {
            client_secret: process.env.MP_MARKETPLACE_CLIENT_SECRET,
            client_id: process.env.MP_MARKETPLACE_CLIENT_ID,
            grant_type: "authorization_code",
            code,
            redirect_uri: process.env.MP_OAUTH_REDIRECT_URI,
        },
        { headers: { "Content-Type": "application/json" } }
    );

    // data.access_token  → token del negocio (expira en aprox 6 meses)
    // data.refresh_token → para renovarlo sin que el usuario vuelva a autorizar

    // Obtenemos los datos del titular de la cuenta MP para mostrarlos en el panel
    let mpAccountName: string | null = null;
    let mpAccountEmail: string | null = null;
    try {
        const { data: mpUser } = await axios.get("https://api.mercadopago.com/v1/users/me", {
            headers: { Authorization: `Bearer ${data.access_token}` },
        });
        mpAccountName = `${mpUser.first_name ?? ""} ${mpUser.last_name ?? ""}`.trim() || null;
        mpAccountEmail = mpUser.email ?? null;
    } catch {
        // no bloqueamos el flujo si falla la consulta de perfil
    }

    const business = await BusinessModel.findByIdAndUpdate(
        businessID,
        {
            mpAccessToken: data.access_token,
            mpRefreshToken: data.refresh_token,
            mpLinked: true,
            mpAccountName,
            mpAccountEmail,
        },
        { new: true }
    );

    if (!business) return "BUSINESS_NOT_FOUND";
    return "LINKED";
};

// Renueva el access_token usando el refresh_token (se debe ejecutar antes de crear una preferencia si el token expiró)
const SRefreshOAuthToken = async (businessID: string) => {
    const business = await BusinessModel.findById(businessID).select(
        "+mpAccessToken +mpRefreshToken"
    );
    if (!business?.mpRefreshToken) return "NO_REFRESH_TOKEN";

    const { data } = await axios.post(
        MP_TOKEN_URL,
        {
            client_secret: process.env.MP_MARKETPLACE_CLIENT_SECRET,
            client_id: process.env.MP_MARKETPLACE_CLIENT_ID,
            grant_type: "refresh_token",
            refresh_token: business.mpRefreshToken,
        },
        { headers: { "Content-Type": "application/json" } }
    );

    await BusinessModel.findByIdAndUpdate(businessID, {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token,
    });

    return data.access_token as string;
};

// Desvincula la cuenta del negocio
const SDisconnectOAuth = async (businessID: string) => {
    const business = await BusinessModel.findByIdAndUpdate(
        businessID,
        { mpAccessToken: null, mpRefreshToken: null, mpLinked: false, mpAccountName: null, mpAccountEmail: null },
        { new: true }
    );
    if (!business) return "BUSINESS_NOT_FOUND";
    return "DISCONNECTED";
};

export {
    SGetOAuthURL,
    SHandleOAuthCallback,
    SRefreshOAuthToken,
    SDisconnectOAuth,
};