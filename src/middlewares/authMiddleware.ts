import { NextFunction, Request, Response } from "express";
import { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";
import { verifyToken } from "../utils/jwtGen.handle";
import { RequestExtended } from "../interfaces/reqExtended.interface";

const checkAuth = async (
  req: RequestExtended,
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

    const tokenIsCorrect = verifyToken(`${reqJwt}`) as { userID: string };

    if (!tokenIsCorrect) {
      return res.status(401).send("INVALID_SESSION");
    } else {
      req.user = tokenIsCorrect;
      next();
    }
  } catch (error) {
    if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
      return res.status(401).send("SESSION_EXPIRED");
    }
    res.status(400).send("NOT_VALID_AUTH");
  }
};

export { checkAuth };
