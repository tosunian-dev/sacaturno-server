import { Request } from "express";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import DayScheduleModel from "../models/dayScheduleModel";
import { IDaySchedule } from '../interfaces/daySchedule.interface';
import { SCheckEmployeeScheduleConflict } from "./employeeServices";
import {
  SAssignManyAppointments,
  SFindAppointmentsFromTemplate,
} from "./appointmentServices";
import EmployeeModel from "../models/employeeModel";

interface BookedMatch {
  _id: string;
  start: Date;
  name: string;
  employeeID: string | null;
  branchID: string | null;
  employeeChosenByClient: boolean;
}

// Una plantilla cambiada y su agenda ya publicada desalineadas dejan slots que
// nadie puede reservar al filtrar. Por eso los turnos LIBRES se propagan solos.
// Los RESERVADOS no: tienen cliente, y cambiarlos le manda un mail — esa decisión
// vuelve al panel, que devuelve la lista para preguntar.
const propagateToGeneratedAppointments = async (
  template: { businessID: string; dayNumber: number; start: Date; service: string },
  fields: { employeeID?: string | null; branchID?: string | null }
) => {
  if (fields.employeeID === undefined && fields.branchID === undefined) {
    return { unbookedUpdated: 0, booked: [] as BookedMatch[] };
  }

  const { unbooked, booked } = await SFindAppointmentsFromTemplate(template);
  const ids = unbooked.map((a) => String(a._id));
  const { assigned } = ids.length
    ? await SAssignManyAppointments(ids, fields)
    : { assigned: [] as string[] };

  return {
    unbookedUpdated: assigned.length,
    booked: booked.map((a): BookedMatch => ({
      _id: String(a._id),
      start: a.start,
      name: a.name,
      employeeID: a.employeeID ?? null,
      branchID: a.branchID ?? null,
      employeeChosenByClient: !!a.employeeChosenByClient,
    })),
  };
};

// GET DAYS AND APPOINTMENTS BY BUSINESSID
const SGetDaysAndAppointmentsByBusinessID = async ({ params }: Request) => {
  const days = await DayScheduleModel.find({
    businessID: params.businessID,
  });
  const appointments = await AppointmentScheduleModel.find({
    businessID: params.businessID,
  }).populate('dayScheduleID');

  return { days, appointments };
};

// Campos que el formulario de horarios edita en un día. Excluye ownerID/businessID
// (mover el día a otro negocio) y cualquier otro campo del schema.
const DAY_EDITABLE = ["day", "appointmentDuration", "dayStart", "dayEnd", "enabled"];

const pickDayFields = (src: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of DAY_EDITABLE) {
    if (src?.[key] !== undefined) out[key] = src[key];
  }
  return out;
};

// EDIT DAY
const SEditDay = async (req: Request) => {
  const editedDay = await DayScheduleModel.findByIdAndUpdate(
    req.params.dayID,
    { $set: pickDayFields(req.body) },
    { new: true }
  );
  return editedDay;
};

const MAX_SCHEDULE_APPOINTMENTS_PER_BUSINESS = 3000;

// CREATE SCHEDULED APPOINTMENT
const SCreateScheduleAppointment = async ({ body }: Request) => {
  const scheduleCount = await AppointmentScheduleModel.countDocuments({ businessID: body.businessID });
  if (scheduleCount >= MAX_SCHEDULE_APPOINTMENTS_PER_BUSINESS) return "SCHEDULE_LIMIT_REACHED";
  if (body.employeeID) {
    const hasConflict = await SCheckEmployeeScheduleConflict(
      body.employeeID,
      body.dayNumber,
      body.start,
      body.end
    );
    if (hasConflict) return "EMPLOYEE_CONFLICT";
    if (body.branchID) {
      const employee = await EmployeeModel.findById(body.employeeID).select("branches");
      if (employee && !(employee.branches ?? []).includes(body.branchID)) {
        return "EMPLOYEE_NOT_IN_BRANCH";
      }
    }
  }
  // Whitelist explícita de los campos de la plantilla (evita colar _id u otros).
  const SCHEDULE_APPOINTMENT_FIELDS = [
    "dayScheduleID", "ownerID", "businessID", "service", "price", "day",
    "dayNumber", "description", "start", "end", "employeeID", "branchID",
  ];
  const createData: Record<string, unknown> = {};
  for (const key of SCHEDULE_APPOINTMENT_FIELDS) {
    if (body?.[key] !== undefined) createData[key] = body[key];
  }
  const newAppointment = await AppointmentScheduleModel.create(createData);
  return newAppointment;
};

// EDIT SCHEDULED APPOINTMENT
const SEditScheduleAppointment = async ({ body, params }: Request) => {
  const current = await AppointmentScheduleModel.findById(params.appointmentID);
  if (!current) return "SCHEDULE_NOT_FOUND";

  const nextStart = body.start ?? current.start;
  const nextEnd = body.end ?? current.end;
  const nextEmployeeID = body.employeeID === undefined ? current.employeeID : body.employeeID;
  const nextBranchID = body.branchID === undefined ? current.branchID : body.branchID;

  if (nextEmployeeID) {
    const hasConflict = await SCheckEmployeeScheduleConflict(
      nextEmployeeID,
      current.dayNumber,
      nextStart,
      nextEnd,
      params.appointmentID
    );
    if (hasConflict) return "EMPLOYEE_CONFLICT";
    if (nextBranchID) {
      const employee = await EmployeeModel.findById(nextEmployeeID).select("branches");
      if (employee && !(employee.branches ?? []).includes(nextBranchID)) {
        return "EMPLOYEE_NOT_IN_BRANCH";
      }
    }
  }

  const allowedFields: Record<string, unknown> = {};
  if (body.service !== undefined) allowedFields.service = body.service;
  if (body.price !== undefined) allowedFields.price = body.price;
  if (body.description !== undefined) allowedFields.description = body.description;
  if (body.start !== undefined) allowedFields.start = body.start;
  if (body.end !== undefined) allowedFields.end = body.end;
  if (body.employeeID !== undefined) allowedFields.employeeID = body.employeeID || null;
  if (body.branchID !== undefined) allowedFields.branchID = body.branchID || null;

  const updated = await AppointmentScheduleModel.findByIdAndUpdate(
    params.appointmentID,
    { $set: allowedFields },
    { new: true }
  );
  if (!updated) return "SCHEDULE_NOT_FOUND";

  // El emparejamiento usa los valores PREVIOS: si acaba de cambiar el servicio,
  // los turnos ya generados todavía llevan el nombre viejo.
  const propagated = await propagateToGeneratedAppointments(
    {
      businessID: current.businessID,
      dayNumber: current.dayNumber,
      start: current.start,
      service: current.service,
    },
    {
      ...(body.employeeID !== undefined ? { employeeID: body.employeeID || null } : {}),
      ...(body.branchID !== undefined ? { branchID: body.branchID || null } : {}),
    }
  );

  return { appointment: updated, propagated };
};

// ASIGNACIÓN MASIVA DE PLANTILLAS
// Procesa una por una y devuelve resumen parcial en lugar de fallar entero: con
// 40 turnos seleccionados, que 2 choquen no puede invalidar los otros 38. El
// orden secuencial importa — cada plantilla ya guardada cuenta como conflicto
// para la siguiente, que es justo lo que evita doblar a un profesional.
const SAssignManyScheduleAppointments = async ({ body }: Request) => {
  const { appointmentIDs, employeeID, branchID } = body as {
    appointmentIDs: string[];
    employeeID?: string | null;
    branchID?: string | null;
  };

  if (!Array.isArray(appointmentIDs) || appointmentIDs.length === 0) {
    return "NO_APPOINTMENTS";
  }

  if (employeeID) {
    const employee = await EmployeeModel.findById(employeeID).select("status");
    if (!employee) return "EMPLOYEE_NOT_FOUND";
    if (employee.status !== "active") return "EMPLOYEE_NOT_ACTIVE";
  }

  // Las sucursales se resuelven por empleado y no una sola vez: al cambiar sólo
  // la sucursal, el profesional a validar es el que ya tenía cada plantilla, no
  // el del pedido — con una lista fija fallaban todas.
  const branchesByEmployee = new Map<string, string[]>();
  const getEmployeeBranches = async (id: string): Promise<string[]> => {
    const cached = branchesByEmployee.get(id);
    if (cached) return cached;
    const employee = await EmployeeModel.findById(id).select("branches");
    const list = employee?.branches ?? [];
    branchesByEmployee.set(id, list);
    return list;
  };

  const assigned: string[] = [];
  const failed: { _id: string; reason: string }[] = [];
  let unbookedUpdated = 0;
  const bookedMatches: BookedMatch[] = [];

  for (const id of appointmentIDs) {
    const current = await AppointmentScheduleModel.findById(id);
    if (!current) {
      failed.push({ _id: id, reason: "NOT_FOUND" });
      continue;
    }

    const nextBranchID = branchID === undefined ? current.branchID : branchID || null;
    const nextEmployeeID = employeeID === undefined ? current.employeeID : employeeID || null;

    if (nextEmployeeID) {
      const employeeBranches = await getEmployeeBranches(nextEmployeeID);
      if (nextBranchID && !employeeBranches.includes(nextBranchID)) {
        failed.push({ _id: id, reason: "NOT_IN_BRANCH" });
        continue;
      }
      const hasConflict = await SCheckEmployeeScheduleConflict(
        nextEmployeeID,
        current.dayNumber,
        current.start,
        current.end,
        id
      );
      if (hasConflict) {
        failed.push({ _id: id, reason: "CONFLICT" });
        continue;
      }
    }

    const update: Record<string, unknown> = {};
    if (employeeID !== undefined) update.employeeID = nextEmployeeID;
    if (branchID !== undefined) update.branchID = nextBranchID;
    await AppointmentScheduleModel.findByIdAndUpdate(id, { $set: update });
    assigned.push(id);

    const result = await propagateToGeneratedAppointments(
      {
        businessID: current.businessID,
        dayNumber: current.dayNumber,
        start: current.start,
        service: current.service,
      },
      {
        ...(employeeID !== undefined ? { employeeID: employeeID || null } : {}),
        ...(branchID !== undefined ? { branchID: branchID || null } : {}),
      }
    );
    unbookedUpdated += result.unbookedUpdated;
    bookedMatches.push(...result.booked);
  }

  // Dos plantillas paralelas del mismo servicio y horario emparejan el mismo
  // turno: sin deduplicar, el panel lo mostraría dos veces y lo asignaría dos veces.
  const uniqueBooked = Array.from(
    new Map(bookedMatches.map((b) => [b._id, b])).values()
  );

  return {
    assigned,
    failed,
    employeeID: employeeID ?? null,
    branchID: branchID ?? null,
    propagated: { unbookedUpdated, booked: uniqueBooked },
  };
};

// DELETE SCHEDULED APPOINTMENT BY APPOINTMENT ID
const SDeleteScheduleAppointment = async ({ params }: Request) => {
  const deletedAppointment = await AppointmentScheduleModel.findByIdAndDelete(params.appointmentID);
  return deletedAppointment;
};

// forEach no espera los callbacks async: la respuesta salía antes de que Mongo
// terminara de escribir, así que refrescar la vista justo después devolvía los
// horarios viejos.
const SEditManyAppointments = async ({ body }: Request) => {
  await Promise.all(
    (body as IDaySchedule[]).map((day) =>
      DayScheduleModel.findByIdAndUpdate(
        day._id,
        { $set: pickDayFields(day as unknown as Record<string, unknown>) }
      )
    )
  );
};

export {
  SGetDaysAndAppointmentsByBusinessID,
  SEditDay,
  SCreateScheduleAppointment,
  SEditScheduleAppointment,
  SAssignManyScheduleAppointments,
  SDeleteScheduleAppointment,
  SEditManyAppointments
};
