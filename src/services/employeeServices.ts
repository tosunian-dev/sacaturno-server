import { Request } from "express";
import crypto from "crypto";
import EmployeeModel from "../models/employeeModel";
import UserModel from "../models/userModel";
import AppointmentModel from "../models/appointmentModel";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import BusinessModel from "../models/businessModel";
import ServiceModel from "../models/serviceModel";
import BranchModel from "../models/branchModel";
import SubscriptionModel from "../models/subscriptionModel";
import { getPlanLimits } from "../config/planLimits";
import dayjs from "dayjs";
import { Resend } from "resend";
import { buildEmail } from "../utils/emailTemplate";
import { encrypt } from "../utils/pwEncrypt.handle";
import { jwtGen } from "../utils/jwtGen.handle";

// Returns all employees for a business (all statuses, owner panel needs pending/inactive too)
const SGetEmployeesByBusiness = async ({ params }: Request) => {
  const employees = await EmployeeModel.find({
    businessID: params.businessID,
  }).select("_id name surname email status permissions branches services userID isOwner");

  const userIDs = employees.map((e) => e.userID).filter((id): id is string => !!id);
  const profileImageMap: Record<string, string> = {};
  if (userIDs.length > 0) {
    const users = await UserModel.find({ _id: { $in: userIDs } }).select("_id profileImage");
    users.forEach((u) => { profileImageMap[u._id.toString()] = u.profileImage ?? "user.png"; });
  }

  return employees.map((e) => ({
    _id: e._id,
    name: e.name,
    surname: e.surname,
    email: e.email,
    status: e.status,
    permissions: e.permissions,
    branches: e.branches,
    services: e.services,
    isOwner: !!e.isOwner,
    profileImage: e.userID ? (profileImageMap[e.userID] ?? "user.png") : "user.png",
  }));
};

const SGetMyEmployeeRecord = async (employeeID: string) => {
  const employee = await EmployeeModel.findById(employeeID)
    .select("_id name surname email status permissions branches services");
  if (!employee) return "EMPLOYEE_NOT_FOUND";

  const [services, branches] = await Promise.all([
    employee.services?.length
      ? ServiceModel.find({ _id: { $in: employee.services } }).select("_id name")
      : [],
    employee.branches?.length
      ? BranchModel.find({ _id: { $in: employee.branches }, deletedAt: null }).select("_id name street number city")
      : [],
  ]);

  return { ...employee.toObject(), services, branches };
};

const uniqueIDs = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String).filter((id, index, all) => all.indexOf(id) === index)
    : [];

// Servicios y sucursales son obligatorios cuando el negocio tiene cargados: un
// empleado sin servicio no puede tomar turnos y uno sin sucursal no aparece en
// ningún flujo de reserva. Si el negocio no tiene ninguno cargado, la lista
// tiene que quedar vacía (no hay nada válido que asignar).
const SValidateEmployeeServices = async (
  businessID: string,
  services: string[],
): Promise<string | null> => {
  const businessServices = await ServiceModel.find({ businessID }).select("_id");
  if (businessServices.length === 0) return services.length > 0 ? "INVALID_SERVICE" : null;
  if (services.length === 0) return "SERVICE_REQUIRED";
  const valid = new Set(businessServices.map((s) => String(s._id)));
  return services.some((id) => !valid.has(id)) ? "INVALID_SERVICE" : null;
};

const SValidateEmployeeBranches = async (
  businessID: string,
  branches: string[],
): Promise<string | null> => {
  const businessBranches = await BranchModel.find({ businessID, deletedAt: null }).select("_id");
  if (businessBranches.length === 0) return branches.length > 0 ? "INVALID_BRANCH" : null;
  if (branches.length === 0) return "BRANCH_REQUIRED";
  const valid = new Set(businessBranches.map((b) => String(b._id)));
  return branches.some((id) => !valid.has(id)) ? "INVALID_BRANCH" : null;
};

const SSendInvitationEmail = async (
  toEmail: string,
  employeeName: string,
  businessName: string,
  token: string
) => {
  const resend = new Resend(process.env.RESEND_KEY);
  const link = `https://sacaturno.com.ar/invite/${token}`;
  await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [toEmail],
    subject: `${businessName} te invitó a SacaTurno`,
    html: buildEmail({
      previewText: "Aceptá la invitación para unirte al equipo",
      badge: "Invitación",
      bannerTitle: "Te invitaron a un equipo",
      greeting: `¡Hola ${employeeName}!`,
      lead: `<b>${businessName}</b> te invitó a ser parte de su equipo en SacaTurno. Aceptá la invitación para activar tu cuenta.`,
      cta: { label: "Aceptar invitación", url: link, style: "solid" },
      afterCtaText: "Esta invitación vence en <b>72 horas</b>.",
    }),
  });
};

const SCreateEmployee = async ({ body }: Request) => {
  const subscription = await SubscriptionModel.findOne({ businessID: body.businessID });
  const { maxEmployees } = getPlanLimits(subscription?.subscriptionType);
  if (maxEmployees === 0) return "PLAN_REQUIRED";

  // El registro del dueño no es una plaza del plan: se cuenta sólo a los invitados.
  const employeeCount = await EmployeeModel.countDocuments({
    businessID: body.businessID,
    isOwner: { $ne: true },
  });
  if (employeeCount >= maxEmployees) return "EMPLOYEE_LIMIT_REACHED";
  const existing = await EmployeeModel.findOne({
    businessID: body.businessID,
    email: body.email,
  });
  if (existing) return "EMPLOYEE_ALREADY_EXISTS";

  const services = uniqueIDs(body.services);
  let branches = uniqueIDs(body.branches);

  // Con una sola sucursal el alta no pregunta (el panel oculta el selector),
  // así que la asignación se resuelve acá.
  if (branches.length === 0) {
    const activeBranches = await BranchModel.find({
      businessID: body.businessID,
      deletedAt: null,
    }).select("_id");
    if (activeBranches.length === 1) branches = [String(activeBranches[0]._id)];
  }

  const serviceError = await SValidateEmployeeServices(body.businessID, services);
  if (serviceError) return serviceError;
  const branchError = await SValidateEmployeeBranches(body.businessID, branches);
  if (branchError) return branchError;

  const invitationToken = crypto.randomBytes(32).toString("hex");
  const invitationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

  const existingUser = await UserModel.findOne({ email: body.email });
  const employeeData = {
    businessID: body.businessID,
    ownerID: body.ownerID,
    name: body.name,
    surname: body.surname ?? "",
    email: body.email,
    status: "pending",
    permissions: body.permissions ?? [],
    services,
    branches,
    invitationToken,
    invitationExpiry,
    userID: existingUser ? String(existingUser._id) : null,
  };

  const employee = await EmployeeModel.create(employeeData);

  // Fetch business name for email
  const business = await BusinessModel.findById(body.businessID).select("name");
  await SSendInvitationEmail(body.email, body.name, business?.name ?? "Tu empleador", invitationToken);

  return employee;
};

// Returns info needed to render the invite page (validates token, hides sensitive data)
const SGetInvitationInfo = async (token: string) => {
  const employee = await EmployeeModel.findOne({ invitationToken: token }).select("+invitationToken");
  if (!employee) return "INVALID_TOKEN";
  if (!employee.invitationExpiry || employee.invitationExpiry < new Date()) return "TOKEN_EXPIRED";
  if (employee.status !== "pending") return "ALREADY_ACCEPTED";

  const business = await BusinessModel.findById(employee.businessID).select("name");
  return {
    employeeName: employee.name,
    businessName: business?.name ?? "",
    hasExistingUser: !!employee.userID,
  };
};

// Accepts the invitation: activates employee and creates/updates user account
const SAcceptInvitation = async (token: string, password?: string) => {
  const employee = await EmployeeModel.findOne({ invitationToken: token })
    .select("+invitationToken");

  if (!employee) return "INVALID_TOKEN";
  if (!employee.invitationExpiry || employee.invitationExpiry < new Date()) return "TOKEN_EXPIRED";
  if (employee.status !== "pending") return "ALREADY_ACCEPTED";

  // If no existing user, a password is required to create their account
  if (!employee.userID) {
    if (!password) return "PASSWORD_REQUIRED";

    // Guard: if a user with this email already exists (e.g. owner testing with own email),
    // link to that user instead of trying to create a duplicate (would throw E11000).
    const existingUser = await UserModel.findOne({ email: employee.email });
    if (existingUser) {
      employee.userID = String(existingUser._id);
    } else {
      const hashed = await encrypt(password);
      const newUser = await UserModel.create({
        name: employee.name,
        surname: employee.surname || employee.name,
        email: employee.email,
        password: hashed,
        verified: true,
      });
      employee.userID = String(newUser._id);
    }
  }

  employee.status = "active";
  employee.invitationToken = null as any;
  employee.invitationExpiry = null as any;
  await employee.save();

  return { success: true };
};

const SResendInvitation = async (employeeID: string, ownerID: string) => {
  const employee = await EmployeeModel.findOne({ _id: employeeID, ownerID }).select("+invitationToken");
  if (!employee) return "EMPLOYEE_NOT_FOUND";
  if (employee.status !== "pending") return "NOT_PENDING";

  const invitationToken = crypto.randomBytes(32).toString("hex");
  const invitationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

  employee.invitationToken = invitationToken;
  employee.invitationExpiry = invitationExpiry;
  await employee.save();

  const business = await BusinessModel.findById(employee.businessID).select("name");
  await SSendInvitationEmail(employee.email, employee.name, business?.name ?? "Tu empleador", invitationToken);

  return { success: true };
};

const SUpdateEmployee = async ({ body, params }: Request) => {
  const { ownerID, ...fields } = body;

  const employee = await EmployeeModel.findOne({ _id: params.employeeID, ownerID }).select("businessID isOwner");
  if (!employee) return "EMPLOYEE_NOT_FOUND";

  // Del registro del dueño sólo se editan sus asignaciones. Identidad, permisos
  // y estado los maneja el toggle de "prestador de servicio", no este endpoint.
  const isOwnerRecord = !!employee.isOwner;
  if (
    isOwnerRecord &&
    (fields.name !== undefined ||
      fields.surname !== undefined ||
      fields.email !== undefined ||
      fields.status !== undefined ||
      fields.permissions !== undefined)
  ) {
    return "OWNER_RECORD_PROTECTED";
  }

  const allowedFields: Record<string, unknown> = {};
  if (fields.name !== undefined) allowedFields.name = fields.name;
  if (fields.surname !== undefined) allowedFields.surname = fields.surname;
  if (fields.email !== undefined) allowedFields.email = fields.email;
  if (fields.status !== undefined) allowedFields.status = fields.status;
  if (fields.permissions !== undefined) allowedFields.permissions = fields.permissions;

  // Cada lista se valida solo si viene en el body: un cambio de permisos o de
  // estado no tiene por qué arrastrar validación de la otra.
  if (fields.services !== undefined) {
    const services = uniqueIDs(fields.services);
    const error = await SValidateEmployeeServices(employee.businessID, services);
    if (error) return error;
    allowedFields.services = services;
  }
  if (fields.branches !== undefined) {
    const branches = uniqueIDs(fields.branches);
    const error = await SValidateEmployeeBranches(employee.businessID, branches);
    if (error) return error;
    allowedFields.branches = branches;
  }

  const updated = await EmployeeModel.findOneAndUpdate(
    { _id: params.employeeID, ownerID },
    { $set: allowedFields },
    { new: true }
  );
  if (!updated) return "EMPLOYEE_NOT_FOUND";
  return updated;
};

const SDeleteEmployee = async ({ params, body }: Request) => {
  // Borrar el registro del dueño dejaría turnos apuntando a un prestador
  // inexistente: para dejar de publicarse se usa el toggle, que lo desactiva.
  const deleted = await EmployeeModel.findOneAndDelete({
    _id: params.employeeID,
    ownerID: body.ownerID,
    isOwner: { $ne: true },
  });
  if (!deleted) return "EMPLOYEE_NOT_FOUND";

  // Sin esto el turno queda apuntando a un empleado inexistente: no aparece en
  // ningún filtro y tampoco lo agarra el filtro "sin asignar", porque no es null.
  // Los turnos pasados conservan el ID como registro histórico.
  await AppointmentModel.updateMany(
    { employeeID: params.employeeID, start: { $gte: new Date() } },
    { $set: { employeeID: null } }
  );
  await AppointmentScheduleModel.updateMany(
    { employeeID: params.employeeID },
    { $set: { employeeID: null } }
  );

  return deleted;
};

const SCheckEmployeeAppointmentConflict = async (
  employeeID: string,
  start: Date,
  end: Date,
  excludeAppointmentID?: string
): Promise<boolean> => {
  const query: Record<string, unknown> = {
    employeeID,
    start: { $lt: new Date(end) },
    end: { $gt: new Date(start) },
  };
  // Al reasignar un turno existente, él mismo no puede contar como conflicto propio.
  if (excludeAppointmentID) query._id = { $ne: excludeAppointmentID };
  const conflict = await AppointmentModel.findOne(query);
  return !!conflict;
};

const SCheckEmployeeScheduleConflict = async (
  employeeID: string,
  dayNumber: number,
  newStart: Date,
  newEnd: Date,
  excludeScheduleID?: string
): Promise<boolean> => {
  const query: Record<string, unknown> = { employeeID, dayNumber };
  // Al editar una plantilla, ella misma no puede contar como conflicto propio.
  if (excludeScheduleID) query._id = { $ne: excludeScheduleID };
  const existing = await AppointmentScheduleModel.find(query);
  const newStartMins = dayjs(newStart).hour() * 60 + dayjs(newStart).minute();
  const newEndMins = dayjs(newEnd).hour() * 60 + dayjs(newEnd).minute();

  for (const appt of existing) {
    const existStartMins = dayjs(appt.start).hour() * 60 + dayjs(appt.start).minute();
    const existEndMins = dayjs(appt.end).hour() * 60 + dayjs(appt.end).minute();
    if (newStartMins < existEndMins && newEndMins > existStartMins) return true;
  }
  return false;
};

const SGetUserContexts = async (userID: string) => {
  const ownedBusiness = await BusinessModel.findOne({ ownerID: userID }).select("_id name");
  // El registro del dueño no es un contexto de empleado: si se colara acá, el
  // selector de contexto le ofrecería entrar dos veces a su propio negocio.
  const employeeRecords = await EmployeeModel.find({
    userID,
    status: "active",
    isOwner: { $ne: true },
  }).select("_id businessID");

  const contexts: Array<{ role: string; businessID: string; businessName: string; employeeID?: string }> = [];
  if (ownedBusiness) {
    contexts.push({ role: "owner", businessID: String(ownedBusiness._id), businessName: ownedBusiness.name });
  }
  for (const emp of employeeRecords) {
    const biz = await BusinessModel.findById(emp.businessID).select("name");
    if (biz) {
      contexts.push({ role: "employee", businessID: String(emp.businessID), businessName: biz.name, employeeID: String(emp._id) });
    }
  }
  return contexts;
};

const SSelectContext = async (
  userId: string,
  role: "owner" | "employee",
  businessID: string,
  employeeID?: string
): Promise<{ contextToken: string } | string> => {
  if (role === "owner") {
    // Fresh user with no business yet — allow owner context without businessID
    if (!businessID) {
      return { contextToken: jwtGen({ userId, role: "owner" }) };
    }
    const business = await BusinessModel.findOne({ _id: businessID, ownerID: userId });
    if (!business) return "CONTEXT_NOT_AUTHORIZED";
    return { contextToken: jwtGen({ userId, role: "owner", businessID }) };
  }
  if (role === "employee") {
    if (!employeeID) return "EMPLOYEE_ID_REQUIRED";
    const employee = await EmployeeModel.findOne({
      _id: employeeID,
      userID: userId,
      businessID,
      status: "active",
      isOwner: { $ne: true },
    }).select("permissions");
    if (!employee) return "CONTEXT_NOT_AUTHORIZED";
    return {
      contextToken: jwtGen({
        userId,
        role: "employee",
        businessID,
        employeeID,
        permissions: employee.permissions ?? [],
      }),
    };
  }
  return "INVALID_ROLE";
};

// El dueño se publica como prestador a través de un registro de empleado propio
// (isOwner). Así los turnos, los filtros y la detección de conflictos lo tratan
// igual que a cualquier otro, sin casos especiales repartidos por el código.
// Despublicarse lo desactiva en vez de borrarlo: los turnos ya asignados tienen
// que seguir resolviendo su nombre.
const SSetOwnerAsProvider = async (
  businessID: string,
  ownerID: string,
  enabled: boolean,
) => {
  const business = await BusinessModel.findOne({ _id: businessID, ownerID }).select("_id");
  if (!business) return "BUSINESS_NOT_FOUND";

  const user = await UserModel.findById(ownerID).select("name surname email profileImage");
  if (!user) return "USER_NOT_FOUND";

  const serialize = (employee: any) => ({
    _id: employee._id,
    name: employee.name,
    surname: employee.surname,
    email: employee.email,
    status: employee.status,
    permissions: employee.permissions ?? [],
    branches: employee.branches ?? [],
    services: employee.services ?? [],
    isOwner: true,
    profileImage: user.profileImage ?? "user.png",
  });

  // Lo que el negocio ofrece hoy. Es lo que se le asigna al dueño la primera
  // vez, y lo que rellena su lista si quedó vacía (se publicó antes de tener
  // servicios o sucursales cargados).
  const [services, branches] = await Promise.all([
    ServiceModel.find({ businessID }).select("_id"),
    BranchModel.find({ businessID, deletedAt: null }).select("_id"),
  ]);
  const allServiceIDs = services.map((s) => String(s._id));
  const allBranchIDs = branches.map((b) => String(b._id));

  const existing = await EmployeeModel.findOne({ businessID, isOwner: true });

  if (existing) {
    existing.status = enabled ? "active" : "inactive";
    // El dueño pudo cambiar su nombre en el perfil después de publicarse.
    existing.name = user.name;
    existing.surname = user.surname ?? "";
    // Sólo se rellena lo que está vacío: una lista recortada a mano es una
    // decisión del dueño y no se pisa.
    if (!existing.services?.length) existing.services = allServiceIDs;
    if (!existing.branches?.length) existing.branches = allBranchIDs;
    await existing.save();
    return serialize(existing);
  }

  if (!enabled) return { disabled: true };

  // El índice único (businessID, email) rebota si el dueño ya se invitó a sí
  // mismo como empleado; conviene decirlo antes de que explote el create.
  const emailTaken = await EmployeeModel.findOne({ businessID, email: user.email });
  if (emailTaken) return "OWNER_EMAIL_CONFLICT";

  // Arranca prestando todo lo que el negocio ofrece hoy: es el caso esperable y
  // deja el registro válido de entrada (servicios y sucursales son obligatorios).
  const employee = await EmployeeModel.create({
    businessID,
    ownerID,
    userID: ownerID,
    name: user.name,
    surname: user.surname ?? "",
    email: user.email,
    status: "active",
    isOwner: true,
    permissions: [],
    services: allServiceIDs,
    branches: allBranchIDs,
  });

  return serialize(employee);
};

const SGetPublicEmployeesByBusiness = async (businessID: string) => {
  const employees = await EmployeeModel.find({ businessID, status: "active" })
    .select("_id name surname branches services userID isOwner");

  const userIDs = employees.map((e) => e.userID).filter((id): id is string => !!id);

  const profileImageMap: Record<string, string> = {};
  if (userIDs.length > 0) {
    const users = await UserModel.find({ _id: { $in: userIDs } }).select("_id profileImage");
    users.forEach((u) => {
      profileImageMap[u._id.toString()] = u.profileImage ?? "user.png";
    });
  }

  return employees.map((e) => ({
    _id: e._id,
    name: e.name,
    surname: e.surname,
    branches: e.branches,
    services: e.services,
    isOwner: !!e.isOwner,
    profileImage: e.userID ? (profileImageMap[e.userID] ?? "user.png") : "user.png",
  }));
};

export {
  SGetEmployeesByBusiness,
  SGetMyEmployeeRecord,
  SCreateEmployee,
  SResendInvitation,
  SUpdateEmployee,
  SDeleteEmployee,
  SCheckEmployeeAppointmentConflict,
  SCheckEmployeeScheduleConflict,
  SGetUserContexts,
  SGetInvitationInfo,
  SAcceptInvitation,
  SSelectContext,
  SGetPublicEmployeesByBusiness,
  SSetOwnerAsProvider,
};
