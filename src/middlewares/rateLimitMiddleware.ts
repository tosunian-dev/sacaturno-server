import { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Limitadores para endpoints públicos sensibles (fuerza bruta y abuso de envío
// de correos). Dependen de `app.set("trust proxy", 1)` en app.ts: sin eso todos
// los requests comparten la IP del proxy de Railway y el límite afecta a todos.
//
// STORE (decisión F-17, diferida a propósito): usan el MemoryStore por defecto,
// que guarda los contadores en la RAM del proceso. Dos límites conocidos:
//   1) se resetean en cada deploy/reinicio (menor: el atacante no fuerza deploys).
//   2) son por-instancia: si Railway escala a N instancias, el límite real pasa a
//      ser límite × N y el rate limiting queda efectivamente roto.
// Ambos son inofensivos mientras corramos UNA sola instancia, que es el caso hoy.
// Al escalar horizontalmente hay que mover el store a un almacén compartido y
// persistente. Opciones: rate-limit-redis (mantenido para express-rate-limit v8,
// requiere infra Redis) o un store propio sobre Mongo (sin infra nueva; ojo que
// rate-limit-mongo quedó en la v6 y NO es compatible con la v8 que usamos).

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
