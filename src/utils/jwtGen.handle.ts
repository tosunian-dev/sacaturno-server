import { sign, verify } from 'jsonwebtoken'
const jwt_secret = process.env.JWT_SECRET || 'A'
const superadmin_jwt_secret = process.env.SUPERADMIN_JWT_SECRET || 'B'

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

const jwtGen = (input: string | JwtContextPayload): string => {
    const payload = typeof input === "string" ? { userId: input } : input;
    return sign(payload, jwt_secret, { expiresIn: "99999999d" });
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