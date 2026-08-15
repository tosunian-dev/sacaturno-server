import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import BusinessModel from "../models/businessModel";
import {
  SBookAppointment,
  SAssignAppointment,
  SAssignManyAppointments,
  SCreateAppointment,
  SGetAppointmentByID,
  SGetAppointmentsByBusinessID,
  SGetAppointmentsByClientID,
  SDeleteAppointment,
  SCancelBooking,
  SCancelBookingByToken,
  SGetAppointmentByCancelToken,
  SGetPublicAppsByBusinessID,
  SGetTodayAppointmentsByBusinessID,
  SCreateAllDayAppointments,
  SGetDaysAndAppointmentsByBusinessID,
  SGetDashboardStats,
  SGetAnalyticsData,
  SGetAppointmentHistory,
  SGetCancelledAppointments,
} from "../services/appointmentServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";
import { hasPermission } from "../utils/checkPermission";
import { userCanAccessBusiness, resolveBusinessID } from "../utils/ownership";
import AppointmentModel from "../models/appointmentModel";

const createAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    if (!(await userCanAccessBusiness(user, req.body.businessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentData = await SCreateAppointment(req.body);
    if (appointmentData === "APPOINTMENT_LIMIT_REACHED") return res.status(400).send("APPOINTMENT_LIMIT_REACHED");
    if (appointmentData === "EMPLOYEE_CONFLICT") return res.status(409).send("EMPLOYEE_CONFLICT");
    if (appointmentData === "EMPLOYEE_NOT_IN_BRANCH") return res.status(400).send("EMPLOYEE_NOT_IN_BRANCH");
    res.send({ appointmentData, msg: "APPOINTMENT_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_APPOINTMENT_CREATION");
  }
};

const bookAppointment = async ({ body }: Request, res: Response) => {
  try {
    const appointmentBooked = await SBookAppointment(body);
    // Los strings son errores semánticos: antes salían con 200 y el cliente los
    // interpretaba como reserva exitosa.
    if (typeof appointmentBooked === "string") {
      const status = appointmentBooked === "SLOT_TAKEN" ? 409 : 400;
      return res.status(status).send({ msg: appointmentBooked });
    }
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_BOOKING_APPOINTMENT");
  }
};

const getAppointmentByID = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const apptBusinessID = await resolveBusinessID(AppointmentModel, req.params.ID);
    if (!apptBusinessID) return res.status(404).send("APPOINTMENT_NOT_FOUND");
    if (!(await userCanAccessBusiness(user, apptBusinessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentBooked = await SGetAppointmentByID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getAppointmentsByBusinessID = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (!(await userCanAccessBusiness(user, req.params.businessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentBooked = await SGetAppointmentsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getAppointmentsByClientID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetAppointmentsByClientID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

// Asignar profesional/sucursal a un turno existente.
// El dueño asigna a quien quiera; un empleado sólo puede tomar un turno libre
// para sí mismo o soltar el que ya tiene — salvo que administre toda la agenda.
const assignAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const { employeeID, branchID, notifyClient } = req.body as {
      employeeID?: string | null;
      branchID?: string | null;
      notifyClient?: boolean;
    };

    let restrictToEmployeeID: string | undefined;
    if (user?.role === "employee") {
      const canManageAll = await hasPermission(user.employeeID!, "manage_all_appointments");
      if (!canManageAll) {
        const canManageOwn = await hasPermission(user.employeeID!, "manage_own_appointments");
        if (!canManageOwn) return res.status(403).send("PERMISSION_DENIED");
        restrictToEmployeeID = user.employeeID!;
      }
    }

    const result = await SAssignAppointment(
      req.params.appointmentID,
      { employeeID, branchID },
      restrictToEmployeeID,
      !!notifyClient
    );
    if (result === "PERMISSION_DENIED") return res.status(403).send("PERMISSION_DENIED");
    if (result === "ALREADY_ASSIGNED") return res.status(409).send("ALREADY_ASSIGNED");
    if (result === "APPOINTMENT_NOT_FOUND") return res.status(404).send("APPOINTMENT_NOT_FOUND");
    if (result === "EMPLOYEE_NOT_FOUND") return res.status(404).send("EMPLOYEE_NOT_FOUND");
    if (result === "EMPLOYEE_NOT_ACTIVE") return res.status(400).send("EMPLOYEE_NOT_ACTIVE");
    if (result === "EMPLOYEE_CONFLICT") return res.status(409).send("EMPLOYEE_CONFLICT");
    if (result === "EMPLOYEE_NOT_IN_BRANCH") return res.status(400).send("EMPLOYEE_NOT_IN_BRANCH");
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_ASSIGN_APPOINTMENT");
  }
};

// Asignación en lote sobre turnos ya creados. La usa el paso de propagación a
// turnos reservados: sólo el dueño (o quien administre toda la agenda) puede
// tocar turnos ajenos, así que acá no aplica el modo "tomarme el turno".
const assignManyAppointments = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "manage_all_appointments");
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }

    const { appointmentIDs, employeeID, branchID, notifyClient } = req.body as {
      appointmentIDs?: string[];
      employeeID?: string | null;
      branchID?: string | null;
      notifyClient?: boolean;
    };
    if (!Array.isArray(appointmentIDs) || appointmentIDs.length === 0) {
      return res.status(400).send("NO_APPOINTMENTS");
    }

    const result = await SAssignManyAppointments(
      appointmentIDs,
      {
        ...(employeeID !== undefined ? { employeeID } : {}),
        ...(branchID !== undefined ? { branchID } : {}),
      },
      !!notifyClient
    );
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_ASSIGN_MANY_APPOINTMENTS");
  }
};

const deleteAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const apptBusinessID = await resolveBusinessID(AppointmentModel, req.params.ID);
    if (!apptBusinessID) return res.status(404).send("APPOINTMENT_NOT_FOUND");
    if (!(await userCanAccessBusiness(user, apptBusinessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentDeleted = await SDeleteAppointment(req);
    res.send(appointmentDeleted);
  } catch (error) {
    handleError(res, "ERROR_DELETE_APPOINTMENT");
  }
};

// Cancelación por el negocio/empleado (autenticado). Siempre reembolsa la seña.
const cancelBooking = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    let cancelledBy: "owner" | "employee" = "owner";
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
      cancelledBy = "employee";
    }
    const result = await SCancelBooking(
      req.body._id,
      cancelledBy,
      req.body.reason,
      user?.businessID
    );
    if (typeof result === "string") return res.status(400).send({ msg: result });
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_CANCEL_BOOKING");
  }
};

// Cancelación por el cliente vía link con token (público). Sólo reembolsa la seña
// si el negocio le había reasignado el turno o si está dentro de la gracia para
// deshacer; la respuesta trae `refundsDeposit` con lo que efectivamente pasó.
const cancelBookingByToken = async (req: Request, res: Response) => {
  try {
    const result = await SCancelBookingByToken(req.body.token, req.body.reason);
    if (typeof result === "string") return res.status(400).send({ msg: result });
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_CANCEL_BOOKING");
  }
};

// Datos del turno para la página pública de cancelación (por token)
const getCancelInfo = async (req: Request, res: Response) => {
  try {
    const info = await SGetAppointmentByCancelToken(req.params.token);
    if (!info) return res.status(404).send({ msg: "APPOINTMENT_NOT_FOUND" });
    res.send(info);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getPublicAppsByBusinessID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetPublicAppsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getTodayAppointmentsByBusinessID = async (
  req: RequestExtended,
  res: Response
) => {
  try {
    const user = req.user as JwtContextPayload;
    if (!(await userCanAccessBusiness(user, req.params.businessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentBooked = await SGetTodayAppointmentsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const createAllDayAppointments = async (req: RequestExtended, res: Response) => {
  try {
    const { body } = req;
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    if (!(await userCanAccessBusiness(user, body.businessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentData = await SCreateAllDayAppointments(body);
    if (appointmentData === "APPOINTMENT_LIMIT_REACHED") return res.status(400).send("APPOINTMENT_LIMIT_REACHED");
    res.send({ appointmentData, msg: "APPOINTMENT_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_APPOINTMENT_CREATION");
  }
};

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await SGetDashboardStats(req);
    res.send(stats);
  } catch (error) {
    handleError(res, "ERROR_GET_DASHBOARD_STATS");
  }
};

const verifyOwnerAccess = async (user: JwtContextPayload, businessID: string): Promise<boolean> => {
  if (user.businessID) return user.businessID === businessID;
  // Fresh context token issued before business was created: verify ownership via DB
  const business = await BusinessModel.findOne({ _id: businessID, ownerID: user.userId });
  return !!business;
};

const getAnalyticsData = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "view_stats");
      if (!allowed || user.businessID !== req.params.businessID) return res.status(403).send("PERMISSION_DENIED");
    } else if (user?.role === "owner") {
      if (!(await verifyOwnerAccess(user, req.params.businessID))) return res.status(403).send("FORBIDDEN");
    }
    const data = await SGetAnalyticsData(req);
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_GET_ANALYTICS");
  }
};

const getAppointmentHistory = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "view_stats");
      if (!allowed || user.businessID !== req.params.businessID) return res.status(403).send("PERMISSION_DENIED");
    } else if (user?.role === "owner") {
      if (!(await verifyOwnerAccess(user, req.params.businessID))) return res.status(403).send("FORBIDDEN");
    }
    const data = await SGetAppointmentHistory(req);
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_GET_HISTORY");
  }
};

const getCancelledAppointments = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "view_stats");
      if (!allowed || user.businessID !== req.params.businessID) return res.status(403).send("PERMISSION_DENIED");
    } else if (user?.role === "owner") {
      if (!(await verifyOwnerAccess(user, req.params.businessID))) return res.status(403).send("FORBIDDEN");
    }
    const data = await SGetCancelledAppointments(req);
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_GET_CANCELLED");
  }
};

export {
  createAppointment,
  bookAppointment,
  assignAppointment,
  assignManyAppointments,
  getAppointmentByID,
  getAppointmentsByBusinessID,
  getAppointmentsByClientID,
  deleteAppointment,
  cancelBooking,
  cancelBookingByToken,
  getCancelInfo,
  getPublicAppsByBusinessID,
  getTodayAppointmentsByBusinessID,
  createAllDayAppointments,
  getDashboardStats,
  getAnalyticsData,
  getAppointmentHistory,
  getCancelledAppointments,
};
