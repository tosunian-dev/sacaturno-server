import crypto from "crypto";
import { Request } from "express";

// Verifica la firma `x-signature` que MercadoPago envía en cada webhook para
// probar que la notificación es auténtica (y no un atacante que conoce un
// payment.id). MP firma con HMAC-SHA256 sobre el manifest:
//
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
//
// usando la "Clave secreta" de la integración (panel de MP → Webhooks).
//
// Rollout sin romper pagos: si el secreto no está configurado NO validamos y
// dejamos pasar con un aviso ruidoso. La protección queda activa recién cuando
// se setea el secreto en el entorno + en el panel de MP. Con secreto presente,
// toda notificación sin firma válida se rechaza.
export const verifyMercadoPagoSignature = (
  req: Request,
  secret: string | undefined,
  label = "MP webhook"
): boolean => {
  if (!secret) {
    console.warn(
      `[${label}] secreto de webhook sin configurar: firma NO verificada (fail-open)`
    );
    return true;
  }

  const signatureHeader = req.headers["x-signature"];
  const requestId = req.headers["x-request-id"];
  if (typeof signatureHeader !== "string" || typeof requestId !== "string") {
    console.warn(`[${label}] faltan cabeceras x-signature / x-request-id`);
    return false;
  }

  // x-signature viene como "ts=1700000000,v1=<hex>"
  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, part) => {
      const idx = part.indexOf("=");
      if (idx > 0) {
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key) acc[key] = value;
      }
      return acc;
    },
    {}
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) {
    console.warn(`[${label}] x-signature sin ts/v1`);
    return false;
  }

  // El id se toma del query param `data.id` (así lo arma MP) y si no del body.
  // MP indica pasarlo en minúsculas cuando es alfanumérico.
  const rawId =
    (typeof req.query["data.id"] === "string" && req.query["data.id"]) ||
    (req.body?.data?.id ?? undefined);
  if (rawId === undefined || rawId === null || rawId === "") {
    console.warn(`[${label}] no se pudo determinar data.id`);
    return false;
  }
  const idStr = String(rawId).toLowerCase();

  const manifest = `id:${idStr};request-id:${requestId};ts:${ts};`;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  // Comparación en tiempo constante para no filtrar la firma por timing.
  // Uint8Array.from (no Buffer.from) evita el choque de tipos con el @types/node
  // nuevo, donde Buffer es Buffer<ArrayBufferLike> e incluye SharedArrayBuffer.
  let a: Uint8Array;
  let b: Uint8Array;
  try {
    a = Uint8Array.from(Buffer.from(computed, "hex"));
    b = Uint8Array.from(Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
