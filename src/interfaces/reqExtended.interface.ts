import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { JwtContextPayload } from '../utils/jwtGen.handle';
export interface RequestExtended extends Request {
    user?: JwtPayload | JwtContextPayload;
}