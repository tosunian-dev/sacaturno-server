import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SGetEmployeesByBusiness,
  SCreateEmployee,
  SResendInvitation,
  SUpdateEmployee,
  SDeleteEmployee,
  SGetUserContexts,
  SGetInvitationInfo,
  SAcceptInvitation,
  SSelectContext,
  SGetMyEmployeeRecord,
  SGetPublicEmployeesByBusiness,
  SSetOwnerAsProvider,
} from "../services/employeeServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";

// Asignación inválida de servicios/sucursales — mismo tratamiento en alta y edición.
const ASSIGNMENT_ERRORS = ["SERVICE_REQUIRED", "INVALID_SERVICE", "BRANCH_REQUIRED", "INVALID_BRANCH"];

const getEmployeesByBusiness = async (req: Request, res: Response) => {
  try {
    const employees = await SGetEmployeesByBusiness(req);
    res.send(employees);
  } catch (error) {
    handleError(res, "ERROR_GET_EMPLOYEES");
  }
};

const createEmployee = async (req: Request, res: Response) => {
  try {
    const employee = await SCreateEmployee(req);
    if (employee === "PLAN_REQUIRED") {
      return res.status(402).send("PLAN_REQUIRED");
    }
    if (employee === "EMPLOYEE_LIMIT_REACHED") {
      return res.status(400).send("EMPLOYEE_LIMIT_REACHED");
    }
    if (employee === "EMPLOYEE_ALREADY_EXISTS") {
      return res.status(409).send("EMPLOYEE_ALREADY_EXISTS");
    }
    if (typeof employee === "string" && ASSIGNMENT_ERRORS.includes(employee)) {
      return res.status(422).send(employee);
    }
    res.send(employee);
  } catch (error) {
    handleError(res, "ERROR_CREATE_EMPLOYEE");
  }
};

const updateEmployee = async (req: Request, res: Response) => {
  try {
    const employee = await SUpdateEmployee(req);
    if (employee === "EMPLOYEE_NOT_FOUND") {
      return res.status(404).send("EMPLOYEE_NOT_FOUND");
    }
    if (employee === "OWNER_RECORD_PROTECTED") {
      return res.status(403).send("OWNER_RECORD_PROTECTED");
    }
    if (typeof employee === "string" && ASSIGNMENT_ERRORS.includes(employee)) {
      return res.status(422).send(employee);
    }
    res.send(employee);
  } catch (error) {
    handleError(res, "ERROR_UPDATE_EMPLOYEE");
  }
};

const setOwnerAsProvider = async (req: RequestExtended, res: Response) => {
  try {
    const ownerID = (req.user as { userId: string })?.userId;
    if (!ownerID) return res.status(401).send("UNAUTHORIZED");

    const { businessID, enabled } = req.body;
    if (!businessID || typeof enabled !== "boolean") {
      return res.status(400).send("INVALID_PAYLOAD");
    }

    const result = await SSetOwnerAsProvider(businessID, ownerID, enabled);
    if (result === "BUSINESS_NOT_FOUND") return res.status(404).send("BUSINESS_NOT_FOUND");
    if (result === "USER_NOT_FOUND") return res.status(404).send("USER_NOT_FOUND");
    if (result === "OWNER_EMAIL_CONFLICT") return res.status(409).send("OWNER_EMAIL_CONFLICT");
    if (result === "SUBSCRIPTION_EXPIRED") return res.status(403).send("SUBSCRIPTION_EXPIRED");
    return res.status(200).json(result);
  } catch (error) {
    handleError(res, "ERROR_SET_OWNER_PROVIDER");
  }
};

const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const employee = await SDeleteEmployee(req);
    if (employee === "EMPLOYEE_NOT_FOUND") {
      return res.status(404).send("EMPLOYEE_NOT_FOUND");
    }
    res.send(employee);
  } catch (error) {
    handleError(res, "ERROR_DELETE_EMPLOYEE");
  }
};

const getMyContexts = async (req: RequestExtended, res: Response) => {
  try {
    const userId = (req.user as { userId: string })?.userId;
    if (!userId) return res.status(401).send("UNAUTHORIZED");
    const contexts = await SGetUserContexts(userId);
    return res.status(200).json(contexts);
  } catch (error) {
    handleError(res, "ERROR_GET_CONTEXTS");
  }
};

const getMyEmployeeRecord = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as { role?: string; employeeID?: string };
    if (user?.role !== "employee" || !user?.employeeID) {
      return res.status(403).send("NOT_AN_EMPLOYEE");
    }
    const employee = await SGetMyEmployeeRecord(user.employeeID);
    if (employee === "EMPLOYEE_NOT_FOUND") return res.status(404).send("EMPLOYEE_NOT_FOUND");
    return res.status(200).json(employee);
  } catch (error) {
    handleError(res, "ERROR_GET_MY_EMPLOYEE_RECORD");
  }
};

const getInvitationInfo = async (req: Request, res: Response) => {
  try {
    const result = await SGetInvitationInfo(req.params.token);
    if (result === "INVALID_TOKEN") return res.status(404).send("INVALID_TOKEN");
    if (result === "TOKEN_EXPIRED") return res.status(410).send("TOKEN_EXPIRED");
    if (result === "ALREADY_ACCEPTED") return res.status(409).send("ALREADY_ACCEPTED");
    return res.status(200).json(result);
  } catch (error) {
    handleError(res, "ERROR_GET_INVITATION");
  }
};

const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const result = await SAcceptInvitation(req.params.token, password);
    if (result === "INVALID_TOKEN") return res.status(404).send("INVALID_TOKEN");
    if (result === "TOKEN_EXPIRED") return res.status(410).send("TOKEN_EXPIRED");
    if (result === "ALREADY_ACCEPTED") return res.status(409).send("ALREADY_ACCEPTED");
    if (result === "PASSWORD_REQUIRED") return res.status(400).send("PASSWORD_REQUIRED");
    return res.status(200).json(result);
  } catch (error) {
    handleError(res, "ERROR_ACCEPT_INVITATION", error);
  }
};

const resendInvitation = async (req: RequestExtended, res: Response) => {
  try {
    const ownerID = (req.user as { userId: string })?.userId;
    if (!ownerID) return res.status(401).send("UNAUTHORIZED");
    const result = await SResendInvitation(req.params.employeeID, ownerID);
    if (result === "EMPLOYEE_NOT_FOUND") return res.status(404).send("EMPLOYEE_NOT_FOUND");
    if (result === "NOT_PENDING") return res.status(409).send("NOT_PENDING");
    return res.status(200).json(result);
  } catch (error) {
    handleError(res, "ERROR_RESEND_INVITATION");
  }
};

const selectContext = async (req: RequestExtended, res: Response) => {
  try {
    const userId = (req.user as { userId: string })?.userId;
    if (!userId) return res.status(401).send("UNAUTHORIZED");
    const { role, businessID, employeeID } = req.body;
    const result = await SSelectContext(userId, role, businessID, employeeID);
    if (result === "CONTEXT_NOT_AUTHORIZED") return res.status(403).send("CONTEXT_NOT_AUTHORIZED");
    if (result === "EMPLOYEE_ID_REQUIRED") return res.status(400).send("EMPLOYEE_ID_REQUIRED");
    if (result === "INVALID_ROLE") return res.status(400).send("INVALID_ROLE");
    return res.status(200).json(result);
  } catch (error) {
    handleError(res, "ERROR_SELECT_CONTEXT");
  }
};

const getPublicEmployeesByBusiness = async (req: Request, res: Response) => {
  try {
    const employees = await SGetPublicEmployeesByBusiness(req.params.businessID);
    res.send(employees);
  } catch (error) {
    handleError(res, "ERROR_GET_PUBLIC_EMPLOYEES");
  }
};

export {
  getEmployeesByBusiness,
  createEmployee,
  resendInvitation,
  updateEmployee,
  deleteEmployee,
  getMyContexts,
  getMyEmployeeRecord,
  getInvitationInfo,
  acceptInvitation,
  selectContext,
  getPublicEmployeesByBusiness,
  setOwnerAsProvider,
};
