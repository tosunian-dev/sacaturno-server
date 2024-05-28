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
  SGetBusinessBySlug
} from "../services/businessServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";

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

const createService = async ({ body }: Request, res: Response) => {
  try {
    const businessData = await SCreateService(body);
    res.send({ msg: "SERVICE_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_SERVICE_CREATION");
  }
};

const deleteService = async (req: Request, res: Response) => {
  try {
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
  getBusinessBySlug
};
