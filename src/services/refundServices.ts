import axios from "axios";
import BusinessModel from "../models/businessModel";
import { SRefreshOAuthToken } from "./mpOAuthServices";

// El dinero de la seña está en la cuenta MP del negocio (modelo marketplace),
// así que el reembolso se autoriza con el access_token del negocio, no con el
// de la plataforma. Mismo patrón de retry en 401 que usa depositServices.

interface RefundResult {
  status: "refunded" | "failed";
  refundID?: string | null;
  amount?: number;
  error?: string;
}

const refundUrl = (paymentID: string) =>
  `https://api.mercadopago.com/v1/payments/${paymentID}/refunds`;

// Reembolsa una seña ya pagada. amount opcional → reembolso total si se omite.
const SRefundDeposit = async (
  businessID: string,
  paymentID: string,
  amount?: number
): Promise<RefundResult> => {
  const business = await BusinessModel.findById(businessID).select(
    "+mpAccessToken +mpRefreshToken"
  );
  if (!business) return { status: "failed", error: "BUSINESS_NOT_FOUND" };
  if (!business.mpAccessToken) return { status: "failed", error: "BUSINESS_NOT_LINKED" };

  const doRefund = async (token: string) => {
    const body = amount && amount > 0 ? { amount } : {};
    const { data } = await axios.post(refundUrl(paymentID), body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Evita reembolsos duplicados si el request se reintenta
        "X-Idempotency-Key": `refund-${paymentID}`,
      },
    });
    return data;
  };

  try {
    const data = await doRefund(business.mpAccessToken);
    return {
      status: "refunded",
      refundID: data?.id?.toString() ?? null,
      amount: data?.amount,
    };
  } catch (error: any) {
    // Token expirado → refrescar y reintentar una vez
    if (error?.status === 401 || error?.response?.status === 401) {
      const newToken = await SRefreshOAuthToken(businessID);
      if (typeof newToken !== "string" || newToken.startsWith("NO_")) {
        return { status: "failed", error: "TOKEN_REFRESH_FAILED" };
      }
      try {
        const data = await doRefund(newToken);
        return {
          status: "refunded",
          refundID: data?.id?.toString() ?? null,
          amount: data?.amount,
        };
      } catch {
        return { status: "failed", error: "REFUND_FAILED" };
      }
    }
    return { status: "failed", error: "REFUND_FAILED" };
  }
};

export { SRefundDeposit };
