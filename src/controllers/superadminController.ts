import { Request, Response } from "express";
import PlatformAdminModel from "../models/platformAdminModel";
import { verify } from "../utils/pwEncrypt.handle";
import { platformAdminJwtGen } from "../utils/jwtGen.handle";
import { handleError } from "../utils/error.handle";
import {
  SGetOverview,
  SGetGrowth,
  SGetRevenue,
  SGetFunnel,
  SGetTopBusinesses,
  SGetFeatureAdoption,
  SGetExpiringSubscriptions,
  SGetBusinesses,
  SGetUsers,
  SGetUserDetail,
} from "../services/superadminServices";

const loginPlatformAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("MISSING_CREDENTIALS");

    const admin = await PlatformAdminModel.findOne({ email });
    if (!admin) return res.status(401).send("INVALID_CREDENTIALS");

    const passwordMatches = await verify(password, admin.password);
    if (!passwordMatches) return res.status(401).send("INVALID_CREDENTIALS");

    const token = platformAdminJwtGen({ adminId: String(admin._id), email: admin.email });
    res.send({ token, name: admin.name, email: admin.email });
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_LOGIN");
  }
};

const getOverview = async (req: Request, res: Response) => {
  try {
    const [overview, topBusinesses, featureAdoption] = await Promise.all([
      SGetOverview(req),
      SGetTopBusinesses(),
      SGetFeatureAdoption(),
    ]);
    res.send({ ...overview, topBusinesses, featureAdoption });
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_OVERVIEW");
  }
};

const getGrowth = async (req: Request, res: Response) => {
  try {
    res.send(await SGetGrowth(req));
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_GROWTH");
  }
};

const getRevenue = async (req: Request, res: Response) => {
  try {
    res.send(await SGetRevenue(req));
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_REVENUE");
  }
};

const getFunnel = async (req: Request, res: Response) => {
  try {
    res.send(await SGetFunnel(req));
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_FUNNEL");
  }
};

const getExpiringSubscriptions = async (req: Request, res: Response) => {
  try {
    res.send(await SGetExpiringSubscriptions());
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_EXPIRING");
  }
};

const getBusinesses = async (req: Request, res: Response) => {
  try {
    res.send(await SGetBusinesses(req));
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_BUSINESSES");
  }
};

const getUsers = async (req: Request, res: Response) => {
  try {
    res.send(await SGetUsers(req));
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_USERS");
  }
};

const getUserDetail = async (req: Request, res: Response) => {
  try {
    const data = await SGetUserDetail(req);
    if (!data) return res.status(404).send("USER_NOT_FOUND");
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_SUPERADMIN_USER_DETAIL");
  }
};

export {
  loginPlatformAdmin,
  getOverview,
  getGrowth,
  getRevenue,
  getFunnel,
  getExpiringSubscriptions,
  getBusinesses,
  getUsers,
  getUserDetail,
};
