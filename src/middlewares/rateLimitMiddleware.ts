import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Limitadores para endpoints públicos sensibles (fuerza bruta y abuso de envío
// de correos). Dependen de `app.set("trust proxy", 1)` en app.ts: sin eso todos
// los requests comparten la IP del proxy de Railway y el límite afecta a todos.

const FIFTEEN_MIN = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const tooManyRequests = (_req: Request, res: Response) =>
  res.status(429).send({ error: "TOO_MANY_REQUESTS" });

const baseOptions = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler: tooManyRequests,
};

// Cada llamada devuelve una instancia con su propio store. Es importante no
// reusar una misma instancia en rutas de sistemas de auth distintos: el store
// es compartido, así que la fuerza bruta contra el login de usuarios agotaría
// también el cupo del login de backstage.
const createLoginLimiters = (scope: string) => ({
  // Por IP. Cuenta todos los requests, no solo los fallidos: SLoginUser responde
  // 200 con "WRONG_PASSWORD" en el body, así que filtrar por código de estado
  // dejaría pasar los intentos fallidos sin contarlos.
  ipLimiter: rateLimit({
    ...baseOptions,
    windowMs: FIFTEEN_MIN,
    limit: 10,
    keyGenerator: (req: Request) => `${scope}:ip:${ipKeyGenerator(req.ip ?? "")}`,
  }),
  // Por cuenta. Corta la fuerza bruta distribuida (muchas IPs contra un mismo
  // email) que el limitador por IP no ve.
  accountLimiter: rateLimit({
    ...baseOptions,
    windowMs: FIFTEEN_MIN,
    limit: 8,
    keyGenerator: (req: Request) => {
      const email = req.body?.email;
      return typeof email === "string" && email
        ? `${scope}:acct:${email.trim().toLowerCase()}`
        : `${scope}:ip:${ipKeyGenerator(req.ip ?? "")}`;
    },
  }),
});

const userLoginLimiters = createLoginLimiters("user");
const superadminLoginLimiters = createLoginLimiters("superadmin");
const googleLoginLimiters = createLoginLimiters("google");

// Creación de cuentas: cada alta dispara un correo de confirmación vía Resend.
const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: ONE_HOUR,
  limit: 5,
});

// Endpoints que envían correo a una dirección arbitraria (recuperación de
// contraseña, reenvío de confirmación): sin límite sirven para inundar la
// casilla de un tercero y quemar cuota de Resend.
const emailSendLimiter = rateLimit({
  ...baseOptions,
  windowMs: ONE_HOUR,
  limit: 5,
});

export {
  userLoginLimiters,
  superadminLoginLimiters,
  googleLoginLimiters,
  registerLimiter,
  emailSendLimiter,
};
