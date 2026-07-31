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
import { encrypt } from "../utils/pwEncrypt.handle";
import { jwtGen } from "../utils/jwtGen.handle";

// Returns all employees for a business (all statuses, owner panel needs pending/inactive too)
const SGetEmployeesByBusiness = async ({ params }: Request) => {
  const employees = await EmployeeModel.find({
    businessID: params.businessID,
  }).select("_id name surname email status permissions branches services userID");

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
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="es">
<head><meta content="text/html; charset=UTF-8" http-equiv="Content-Type" /></head>
<body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
    <tbody>
      <tr style="width:100%">
        <td>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;padding:30px">
            <tbody style="margin:auto">
              <tr><td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td></tr>
            </tbody>
          </table>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
            <tbody><tr><td>
              <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                <tbody style="width:100%"><tr style="width:100%">
                  <td style="border-bottom:1px solid rgba(238,238,238,0);width:249px"></td>
                  <td style="border-bottom:1px solid rgb(221,73,36);width:102px"></td>
                  <td style="border-bottom:1px solid rgba(238,238,238,0);width:249px"></td>
                </tr></tbody>
              </table>
            </td></tr></tbody>
          </table>
          <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top:20px">
            <tbody><tr><td>
              <p style="font-size:15px;line-height:1.5;margin:16px 0;font-weight:600;">¡Hola ${employeeName}!</p>
              <p style="font-size:14px;line-height:1.5;margin:16px 0;"><b>${businessName}</b> te invitó a ser parte de su equipo en SacaTurno. Para aceptar la invitación y activar tu cuenta, hacé click en el botón de abajo.</p>
              <p style="font-size:13px;line-height:1.5;margin:16px 0;color:#888">Esta invitación vence en 72 horas.</p>
              <div style="width:100%;height:fit-content;display:flex;justify-content:center;margin-top:2.4rem;">
                <a href="${link}" target="_blank" style="margin:auto;background-color:rgb(221,73,36);border-radius:8px;color:rgb(255,255,255);display:inline-block;font-size:12px;font-weight:bold;line-height:40px;padding:0px 16px;text-align:center;text-transform:uppercase;text-decoration:none;width:auto;">Aceptar invitación</a>
              </div>
            </td></tr></tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
  <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
    <tbody><tr><td>
      <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
        <tbody style="width:100%"><tr style="width:100%">
          <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
        </tr></tbody>
      </table>
    </td></tr></tbody>
  </table>
</body>
</html>`,
  });
};

const SCreateEmployee = async ({ body }: Request) => {
  const subscription = await SubscriptionModel.findOne({ businessID: body.businessID });
  const { maxEmployees } = getPlanLimits(subscription?.subscriptionType);
  if (maxEmployees === 0) return "PLAN_REQUIRED";

  const employeeCount = await EmployeeModel.countDocuments({ businessID: body.businessID });
  if (employeeCount >= maxEmployees) return "EMPLOYEE_LIMIT_REACHED";
  const existing = await EmployeeModel.findOne({
    businessID: body.businessID,
    email: body.email,
  });
  if (existing) return "EMPLOYEE_ALREADY_EXISTS";

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
  const allowedFields: Record<string, unknown> = {};
  if (fields.name !== undefined) allowedFields.name = fields.name;
  if (fields.surname !== undefined) allowedFields.surname = fields.surname;
  if (fields.email !== undefined) allowedFields.email = fields.email;
  if (fields.status !== undefined) allowedFields.status = fields.status;
  if (fields.permissions !== undefined) allowedFields.permissions = fields.permissions;
  if (fields.branches !== undefined) allowedFields.branches = fields.branches;
  if (fields.services !== undefined) allowedFields.services = fields.services;
  const updated = await EmployeeModel.findOneAndUpdate(
    { _id: params.employeeID, ownerID },
    { $set: allowedFields },
    { new: true }
  );
  if (!updated) return "EMPLOYEE_NOT_FOUND";
  return updated;
};

const SDeleteEmployee = async ({ params, body }: Request) => {
  const deleted = await EmployeeModel.findOneAndDelete({
    _id: params.employeeID,
    ownerID: body.ownerID,
  });
  if (!deleted) return "EMPLOYEE_NOT_FOUND";
  return deleted;
};

const SCheckEmployeeAppointmentConflict = async (
  employeeID: string,
  start: Date,
  end: Date
): Promise<boolean> => {
  const conflict = await AppointmentModel.findOne({
    employeeID,
    start: { $lt: new Date(end) },
    end: { $gt: new Date(start) },
  });
  return !!conflict;
};

const SCheckEmployeeScheduleConflict = async (
  employeeID: string,
  dayNumber: number,
  newStart: Date,
  newEnd: Date
): Promise<boolean> => {
  const existing = await AppointmentScheduleModel.find({ employeeID, dayNumber });
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
  const employeeRecords = await EmployeeModel.find({ userID, status: "active" }).select("_id businessID");

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

const SGetPublicEmployeesByBusiness = async (businessID: string) => {
  const employees = await EmployeeModel.find({ businessID, status: "active" })
    .select("_id name surname branches services userID");

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
};
