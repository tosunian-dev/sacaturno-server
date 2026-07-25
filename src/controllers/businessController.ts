import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SCreateBusiness,
  SGetBusinessByOwnerID,
  SEditBusinessData,
  SUpdateBusinessImage,
  SGetBusinessByName,
  SGetBusinessByID,
  SCreateService,
  SDeleteService,
  SGetServicesByBusinessID,
  SGetServicesByOwnerID,
  SGetBusinessBySlug,
  SGetBusinessByEmail,
  SEditServiceData,
  SEditScheduleAutomationParams,
  SGetAllBusinessSlugs,
} from "../services/businessServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";
import { hasPermission } from "../utils/checkPermission";

const createBusiness = async ({ body }: Request, res: Response) => {
  try {
    const businessData = await SCreateBusiness(body);
    res.send({ businessData, msg: "BUSINESS_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_BUSINESS_CREATION");
  }
};

const getBusinessByOwnerID = async (req: Request, res: Response) => {
  try {
    const businessData = await SGetBusinessByOwnerID(req);
    if (!businessData) {
      return res.send("BUSINESS_NOT_FOUND");
    }
    res.send(businessData);
  } catch (error) {
    handleError(res, "ERROR_BUSINESS_GET");
  }
};

const editBusinessData = async ({ body }: Request, res: Response) => {
  try {
    const editedBusiness = await SEditBusinessData(body);
    if (editedBusiness === "BUSINESS_NOT_FOUND") {
      return res.send({ msg: "BUSINESS_NOT_FOUND" });
    }
    res.send({ editedBusiness, msg: "BUSINESS_EDITED" });
  } catch (error) {
    handleError(res, "ERROR_BUSINESS_EDIT");
  }
};

const updateBusinessImage = async (req: RequestExtended, res: Response) => {
  try {
    const { user, file } = req;
    const path: string = `${file?.path}`.split("\\")[4];

    const data = {
      file_name: `${file?.filename}`,
      path,
      userId: `${user?.userId}`,
    };
    const response_data = await SUpdateBusinessImage(data);
    res.send(response_data);
  } catch (error) {
    handleError(res, "ERROR_UPLOAD_PROFILEPIC");
  }
};

const getBusinessByName = async (req: Request, res: Response) => {
  try {
    const businessData = await SGetBusinessByName(req);
    if (!businessData) {
      return res.send("BUSINESS_NOT_FOUND");
    }
    res.send(businessData);
  } catch (error) {
    handleError(res, "ERROR_BUSINESS_GET");
  }
};

const getBusinessByID = async (req: Request, res: Response) => {
  try {
    const businessData = await SGetBusinessByID(req);
    if (!businessData) {
      return res.send("BUSINESS_NOT_FOUND");
    }
    res.send(businessData);
  } catch (error) {
    handleError(res, "ERROR_BUSINESS_GET");
  }
};

const getServicesByBusinessID = async (req: Request, res: Response) => {
  try {
    const servicesData = await SGetServicesByBusinessID(req);
    if (!servicesData) {
      return res.send("SERVICES_NOT_FOUND");
    }
    res.send(servicesData);
  } catch (error) {
    handleError(res, "ERROR_GET_SERVICES");
  }
};

const getServicesByOwnerID = async (req: Request, res: Response) => {
  try {
    const servicesData = await SGetServicesByOwnerID(req);
    if (!servicesData) {
      return res.send("SERVICES_NOT_FOUND");
    }
    res.send(servicesData);
  } catch (error) {
    handleError(res, "ERROR_GET_SERVICES");
  }
};

const createService = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "manage_services");
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const businessData = await SCreateService(req.body);
    if (businessData === "SERVICE_LIMIT_REACHED") {
      return res.status(400).json({ msg: "SERVICE_LIMIT_REACHED" });
    }
    res.send({ msg: "SERVICE_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_SERVICE_CREATION");
  }
};

const deleteService = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "manage_services");
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const businessData = await SDeleteService(req);
    res.send({ businessData, msg: "SERVICE_DELETED" });
  } catch (error) {
    handleError(res, "ERROR_SERVICE_DELETION");
  }
};

const getBusinessBySlug = async (req: Request, res: Response) => {
  try {
    const servicesData = await SGetBusinessBySlug(req);
    if (!servicesData) {
      return res.send("BUSINESS_NOT_FOUND");
    }
    res.send(servicesData);
  } catch (error) {
    handleError(res, "ERROR_GET_BUSINESS");
  }
};

const getBusinessByEmail = async (req: Request, res: Response) => {
  try {
    const servicesData = await SGetBusinessByEmail(req);
    if (!servicesData) {
      return res.send("BUSINESS_NOT_FOUND");
    }
    res.send(servicesData);
  } catch (error) {
    handleError(res, "ERROR_GET_BUSINESS");
  }
};

const editService = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "manage_services");
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const editedService = await SEditServiceData(req.body);
    if (editedService === "SERVICE_NOT_FOUND") {
      return res.send({ msg: "SERVICE_NOT_FOUND" });
    }
    res.send({ editedService, msg: "SERVICE_EDITED" });
  } catch (error) {
    handleError(res, "ERROR_SERVICE_EDIT");
  }
};

const editScheduleAutomationParams = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") return res.status(403).send("PERMISSION_DENIED");
    if (user?.role === "owner" && user.businessID !== req.params.businessID) {
      return res.status(403).send("FORBIDDEN");
    }
    const editedBusiness = await SEditScheduleAutomationParams(req);
    res.send({ editedBusiness, msg: "SCHEDULE_EDITED" });
  } catch (error) {
    handleError(res, "ERROR_EDIT_SCHEDULE");
  }
};

const getAllBusinessSlugs = async (_req: Request, res: Response) => {
  try {
    const businesses = await SGetAllBusinessSlugs();
    res.send(businesses);
  } catch (error) {
    handleError(res, "ERROR_GET_BUSINESSES");
  }
};

export {
  createBusiness,
  getBusinessByName,
  editBusinessData,
  updateBusinessImage,
  getBusinessByOwnerID,
  getBusinessByID,
  createService,
  deleteService,
  getServicesByBusinessID,
  getServicesByOwnerID,
  getBusinessBySlug,
  getBusinessByEmail,
  editService,
  editScheduleAutomationParams,
  getAllBusinessSlugs,
};
