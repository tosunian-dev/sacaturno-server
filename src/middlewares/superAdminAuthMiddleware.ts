import { NextFunction, Request, Response } from "express";
import { verifyPlatformAdminToken, PlatformAdminJwtPayload } from "../utils/jwtGen.handle";

export interface SuperAdminRequest extends Request {
  platformAdmin?: PlatformAdminJwtPayload;
}

const checkSuperAdmin = async (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.headers.authorization === undefined) {
      return res.status(401).send("TOKEN_NOT_GIVEN");
    }
    const isBearer = req.headers.authorization.startsWith("Bearer");
    if (!isBearer) {
      return res.status(401).send("INVALID_TOKEN_TYPE");
    }

    const reqJwtBearer = req.headers.authorization || " ";
    const reqJwt = reqJwtBearer.split(" ").pop();

    const tokenIsCorrect = verifyPlatformAdminToken(`${reqJwt}`) as PlatformAdminJwtPayload;

    if (!tokenIsCorrect || typeof tokenIsCorrect === "string" || !tokenIsCorrect.adminId) {
      return res.status(401).send("INVALID_SESSION");
    }

    req.platformAdmin = tokenIsCorrect;
    next();
  } catch (error) {
    res.status(401).send("INVALID_SESSION");
  }
};

export { checkSuperAdmin };
