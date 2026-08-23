import { sign, verify, SignOptions } from 'jsonwebtoken'

// Sin fallback a propósito: un secreto por defecto ('A'/'B') convierte un typo
// en la env var en un compromiso total (cualquiera firma tokens de usuario o de
// superadmin). Preferimos que el proceso no arranque a que arranque inseguro.
const jwt_secret = process.env.JWT_SECRET
const superadmin_jwt_secret = process.env.SUPERADMIN_JWT_SECRET

if (!jwt_secret) {
    throw new Error('JWT_SECRET no está configurado — abortando arranque del servidor')
}
if (!superadmin_jwt_secret) {
    throw new Error('SUPERADMIN_JWT_SECRET no está configurado — abortando arranque del servidor')
}

export interface JwtContextPayload {
    userId: string;
    role?: "owner" | "employee";
    businessID?: string;
    employeeID?: string;
    permissions?: string[];
}

export interface PlatformAdminJwtPayload {
    adminId: string;
    email: string;
}

// expiresIn por defecto "30d" (sesiones y verificación de email). El flujo de
// recuperación de contraseña pasa una duración corta: un link que resetea la
// clave no puede seguir vivo 30 días.
const jwtGen = (
    input: string | JwtContextPayload,
    expiresIn: SignOptions["expiresIn"] = "30d"
): string => {
    const payload = typeof input === "string" ? { userId: input } : input;
    return sign(payload, jwt_secret, { expiresIn });
}

const verifyToken = (token: string) => {
    if(token){
        const isValid = verify( token, jwt_secret )
        return isValid
    } else {
        return 'No token to verify'
    }

}

// Separate secret + short expiry: platform-wide analytics access is far more
// sensitive than a single business's session, so it doesn't share the
// never-expiring business JWT.
const platformAdminJwtGen = (payload: PlatformAdminJwtPayload): string => {
    return sign(payload, superadmin_jwt_secret, { expiresIn: "7d" });
}

const verifyPlatformAdminToken = (token: string) => {
    if (token) {
        return verify(token, superadmin_jwt_secret);
    } else {
        return 'No token to verify'
    }
}

export {
    jwtGen,
    verifyToken,
    platformAdminJwtGen,
    verifyPlatformAdminToken,
}