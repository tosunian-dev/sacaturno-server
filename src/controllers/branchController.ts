import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SGetBranchesByBusiness,
  SCreateBranch,
  SEditBranch,
  SDeleteBranch,
  SGetPublicBranchesByBusiness,
} from "../services/branchServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";

const getBranches = async (req: Request, res: Response) => {
  try {
    const branches = await SGetBranchesByBusiness(req);
    res.send(branches);
  } catch (error) {
    handleError(res, "ERROR_GET_BRANCHES");
  }
};

const createBranch = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as { role?: string; userId?: string };
    if (user?.role !== "owner") return res.status(403).send("FORBIDDEN");

    const result = await SCreateBranch(req);
    if (result === "BRANCH_ADDRESS_REQUIRED") return res.status(400).send("BRANCH_ADDRESS_REQUIRED");
    if (result === "PLAN_REQUIRED") return res.status(402).send("PLAN_REQUIRED");
    if (result === "BRANCH_LIMIT_REACHED") return res.status(400).send("BRANCH_LIMIT_REACHED");
    if (result === "BRANCH_NAME_TAKEN") return res.status(409).send("BRANCH_NAME_TAKEN");
    // Respuesta enriquecida: además de la sucursal, el resumen de lo que se
    // reasignó automáticamente, que el front usa para el modal informativo.
    res.status(201).send(result);
  } catch (error) {
    handleError(res, "ERROR_CREATE_BRANCH");
  }
};

const editBranch = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as { role?: string };
    if (user?.role !== "owner") return res.status(403).send("FORBIDDEN");

    const result = await SEditBranch(req);
    if (result === "BRANCH_ADDRESS_REQUIRED") return res.status(400).send("BRANCH_ADDRESS_REQUIRED");
    if (result === "BRANCH_NOT_FOUND") return res.status(404).send("BRANCH_NOT_FOUND");
    if (result === "BRANCH_NAME_TAKEN") return res.status(409).send("BRANCH_NAME_TAKEN");
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_EDIT_BRANCH");
  }
};

const deleteBranch = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as { role?: string };
    if (user?.role !== "owner") return res.status(403).send("FORBIDDEN");

    const result = await SDeleteBranch(req);
    if (result === "BRANCH_NOT_FOUND") return res.status(404).send("BRANCH_NOT_FOUND");
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_DELETE_BRANCH");
  }
};

const getPublicBranches = async (req: Request, res: Response) => {
  try {
    const branches = await SGetPublicBranchesByBusiness(req.params.businessID);
    res.send(branches);
  } catch (error) {
    handleError(res, "ERROR_GET_PUBLIC_BRANCHES");
  }
};

export { getBranches, createBranch, editBranch, deleteBranch, getPublicBranches };
