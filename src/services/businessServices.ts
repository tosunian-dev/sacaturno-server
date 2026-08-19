import { IBusiness } from "../interfaces/business.interface";
import { IService } from "../interfaces/service.interface";
import BusinessModel from "../models/businessModel";
import { Request } from "express";
import {
  uploadImage,
  deleteImage,
  isCloudinaryConfigured,
} from "../config/cloudinary";
import ServiceModel from "../models/serviceModel";
import EmployeeModel from "../models/employeeModel";
import { isValidObjectId } from "mongoose";
import dayjs from "dayjs";
import ISubscription from "../interfaces/subscription.interface";
import SubscriptionModel from "../models/subscriptionModel";
import PlanPaymentModel from "../models/planPaymentModel";
import { IPlanPayment } from "../interfaces/planPayment.interface";
import { IDaySchedule } from "../interfaces/daySchedule.interface";
import DayScheduleModel from "../models/dayScheduleModel";
import { generateAppointments } from "../utils/appointmentGenerator";
import AppointmentModel from "../models/appointmentModel";
import { escapeRegExp } from "../utils/regex";

const SCreateBusiness = async (businessData: IBusiness) => {
  if (typeof businessData.slug === "string") {
    businessData.slug = businessData.slug.trim();
  }
  // CHECK IF BUSINESS EXISTS
  const businessExists = await BusinessModel.find({
    $or: [{ ownerID: businessData.ownerID }, { name: businessData.name }],
  });
  if (businessExists.length > 0) {
    return "BUSINESS_EXISTS";
  }
  const slugExists = await BusinessModel.find({ slug: businessData.slug });
  if (slugExists.length > 0) {
    return "SLUG_EXISTS";
  }
  // CREATE BUSINESS
  const createdBusiness = await BusinessModel.create(businessData);

  // CREATE FREE SUBSCRIPTION DETAILS

  // FOR 1 MONTH FREE TRIAL
  // const paymentDate = dayjs();
  // const expiracyDate = paymentDate.add(1, "month");

  const paymentDate = dayjs();
  const expDate = paymentDate.add(15, "day");

  const subDetails: ISubscription = {
    ownerID: businessData.ownerID,
    businessID: createdBusiness._id,
    subscriptionType: "SC_FREE",
    paymentDate: paymentDate.toDate(),
    expiracyDate: expDate.toDate(),
  };
  const subscriptionDetails = await SubscriptionModel.create(subDetails);
  const planPayment: IPlanPayment = await PlanPaymentModel.create({
    price: 0,
    businessID: createdBusiness._id,
    userID: businessData.ownerID,
    paymentDate: paymentDate.toDate(),
    subscriptionType: "SC_FREE",
    mpPaymentID: "",
    email: createdBusiness.email,
  });

  // CREATE SCHEDULE: ADD 7 DAYS IN DAY_SCHEDULES
  const daysToSave: IDaySchedule[] = [];
  const dayNames = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

  for (let day = 0; day < dayNames.length; day++) {
    const dayObj: IDaySchedule = {
      appointmentDuration: 60,
      businessID: createdBusiness._id,
      ownerID: businessData.ownerID,
      day: dayNames[day],
      dayStart: 9,
      dayEnd: 17,
      enabled: true,
    };
    daysToSave.push(dayObj);
  }

  await DayScheduleModel.insertMany(daysToSave);

  return { createdBusiness, subscriptionDetails };
};

const SGetBusinessByOwnerID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ ownerID: params.ownerID });
  return businessData;
};

const SEditBusinessData = async (businessData: IBusiness) => {
  if (typeof businessData.slug === "string") {
    businessData.slug = businessData.slug.trim();
  }
  const slugExists = await BusinessModel.find({ slug: businessData.slug });
  if (
    slugExists.length === 0 ||
    slugExists[0]._id.toString() === businessData._id
  ) {
    // Whitelist: solo los campos que el negocio edita desde su formulario. Pasar
    // el body entero permitía mass assignment de campos sensibles del schema:
    // ownerID (robar/ceder el negocio), mpLinked/mpAccessToken/mpAccountEmail
    // (falsear el vínculo con Mercado Pago), image/imagePublicId (saltear la subida).
    const BUSINESS_EDITABLE = [
      "name", "businessType", "businessCategory", "email", "phone",
      "street", "number", "city", "province", "slug",
      "scheduleAnticipation", "scheduleDaysToCreate", "scheduleEnd",
      "automaticSchedule", "bookingsEnabled", "cancellationWindowHours",
    ];
    const allowed: Record<string, unknown> = {};
    const src = businessData as unknown as Record<string, unknown>;
    for (const key of BUSINESS_EDITABLE) {
      if (src[key] !== undefined) allowed[key] = src[key];
    }
    const editedBusiness = await BusinessModel.findByIdAndUpdate(
      businessData._id,
      { $set: allowed },
      { new: true }
    );
    if (editedBusiness === null) {
      return "BUSINESS_NOT_FOUND";
    }
    return editedBusiness;
  } else {
    return "ERROR_EDIT_SLUG_EXISTS";
  }
};

const SUpdateBusinessImage = async (imageData: {
  buffer: Buffer;
  userId: string;
}) => {
  if (!isCloudinaryConfigured()) {
    return "CLOUDINARY_NOT_CONFIGURED";
  }

  const uploaded = await uploadImage(imageData.buffer);

  // findOneAndUpdate sin `new` devuelve el documento previo, que es justo lo que
  // hace falta para saber qué imagen vieja hay que borrar.
  const previousBusiness = await BusinessModel.findOneAndUpdate(
    { ownerID: imageData.userId },
    { image: uploaded.url, imagePublicId: uploaded.publicId }
  );

  await deleteImage(previousBusiness?.imagePublicId);

  return await BusinessModel.findOne({ ownerID: imageData.userId });
};

const SGetBusinessByName = async ({ params }: Request) => {
  // Ruta PÚBLICA: el nombre viene de la URL sin sanitizar. Se escapa para tratarlo
  // como texto literal (evita ReDoS, ".*" que lista toda la colección, y "(" que
  // rompía `new RegExp`). Sigue siendo búsqueda por substring, case-insensitive.
  const safe = escapeRegExp(params.name);
  if (!safe) {
    return "BUSINESS_NOT_FOUND";
  }
  const businessData = await BusinessModel.find({
    name: { $regex: safe, $options: "i" },
  });
  if (businessData.length === 0) {
    return "BUSINESS_NOT_FOUND";
  }
  return businessData;
};

const SGetBusinessByID = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ _id: params.ID });
  return businessData;
};

const SGetBusinessBySlug = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ slug: params.slug });
  return businessData;
};

const SGetBusinessByEmail = async ({ params }: Request) => {
  const businessData = await BusinessModel.findOne({ email: params.email });
  return businessData;
};

const SGetAllBusinessSlugs = async () => {
  return await BusinessModel.find({}, { slug: 1, updatedAt: 1, _id: 0 }).lean();
};

const SGetServicesByBusinessID = async ({ params }: Request) => {
  const servicesData = await ServiceModel.find({
    businessID: params.businessID,
  });
  return servicesData;
};

const SGetServicesByOwnerID = async ({ params }: Request) => {
  const servicesData = await ServiceModel.find({ ownerID: params.ownerID });
  return servicesData;
};

const MAX_SERVICES_PER_BUSINESS = 200;

const SCreateService = async (serviceData: IService & { employeeIDs?: string[] }) => {
  const { employeeIDs, ...service } = serviceData;
  // La seña se cobra por adelantado contra el precio del servicio: si lo supera,
  // el cliente pagaría de más y el negocio quedaría debiéndole la diferencia.
  if ((service.depositAmount ?? 0) > service.price) {
    return "DEPOSIT_EXCEEDS_PRICE";
  }
  const serviceCount = await ServiceModel.countDocuments({ businessID: service.businessID });
  if (serviceCount >= MAX_SERVICES_PER_BUSINESS) {
    return "SERVICE_LIMIT_REACHED";
  }
  const createdService = await ServiceModel.create(service);

  // La relación empleado↔servicio vive del lado del empleado, así que la
  // asignación elegida al crear el servicio se escribe ahí. El filtro por
  // businessID evita asignar empleados de otro negocio.
  const assignTo = (Array.isArray(employeeIDs) ? employeeIDs : [])
    .map(String)
    .filter((id) => isValidObjectId(id));
  if (assignTo.length > 0) {
    await EmployeeModel.updateMany(
      { _id: { $in: assignTo }, businessID: service.businessID },
      { $addToSet: { services: String(createdService._id) } }
    );
  }

  return createdService;
};

const SDeleteService = async ({ params }: Request) => {
  await ServiceModel.findByIdAndDelete(params.serviceID);
  // Sin esto el empleado queda con un servicio inexistente en la lista, que
  // cuenta como asignación válida pero no matchea ningún turno.
  await EmployeeModel.updateMany(
    { services: params.serviceID },
    { $pull: { services: params.serviceID } }
  );
};

const SEditServiceData = async (serviceData: {
  id: string;
  name: string;
  description: string;
  price: number;
  duration?: number;
  depositAmount?: number;
}) => {
  // El body puede traer sólo algunos campos, así que los que faltan se comparan
  // contra lo que ya está guardado.
  const currentService = await ServiceModel.findById(serviceData.id);
  if (!currentService) return "SERVICE_NOT_FOUND";
  const price = serviceData.price ?? currentService.price;
  const depositAmount = serviceData.depositAmount ?? currentService.depositAmount ?? 0;
  if (depositAmount > price) {
    return "DEPOSIT_EXCEEDS_PRICE";
  }

  // Whitelist: nunca el body entero, para que no se pueda mover el servicio a
  // otro negocio (businessID/ownerID) vía mass assignment.
  const allowed: Record<string, unknown> = {};
  const src = serviceData as unknown as Record<string, unknown>;
  for (const key of ["name", "description", "price", "duration", "depositAmount"]) {
    if (src[key] !== undefined) allowed[key] = src[key];
  }
  const editedService = await ServiceModel.findByIdAndUpdate(
    serviceData.id,
    { $set: allowed },
    { new: true }
  );
  if (editedService) return editedService;
  if (editedService === null) {
    return "SERVICE_NOT_FOUND";
  }
};

const SEditScheduleAutomationParams = async (req: Request) => {
  // Whitelist: este endpoint solo toca los 3 parámetros de automatización. Pasar
  // req.body entero a BusinessModel permitía escribir CUALQUIER campo del negocio
  // (ownerID, mpLinked, slug…) y encima sin el chequeo de slug único.
  const automationUpdate: Record<string, unknown> = {};
  for (const key of ["scheduleAnticipation", "scheduleDaysToCreate", "automaticSchedule"]) {
    if (req.body?.[key] !== undefined) automationUpdate[key] = req.body[key];
  }
  const scheduleData = await BusinessModel.findByIdAndUpdate(
    req.params.businessID,
    { $set: automationUpdate }
  );

  // regenerar turnos al guardar cambios estando automaticSchedule activo
  if (
    scheduleData?.automaticSchedule === true &&
    req.body.automaticSchedule === true
  ) {
    const businessData = await BusinessModel.findById(req.params.businessID);
    // buscar todos los turnos desde la fecha de hoy y borrarlos
    const deleteFutureAppointments = await AppointmentModel.deleteMany({
      //start: { $gte: dayjs().startOf("day").toDate() },
      businessID: req.params.businessID,
      status: "unbooked",
    });

    // generar nuevos turnos con los parametros nuevos
    if (businessData) await generateAppointments(businessData);
  }

  // guardar datos de agenda y regenerar turnos al guardar cambios estando automaticSchedule desactivado
  // comparar el campo automaticSchedule
  if (
    scheduleData?.automaticSchedule === false &&
    req.body.automaticSchedule === true
  ) {
    // en businessmodel cambiar scheduleEnd con la fecha de hoy + scheduledaystocreate
    const scheduleEndToSave = dayjs()
      .add(req.body.scheduleDaysToCreate, "day")
      .toDate();
    const updatedBusiness = await BusinessModel.findByIdAndUpdate(
      req.params.businessID,
      { scheduleEnd: scheduleEndToSave },
      { new: true }
    );

    // buscar todos los turnos desde la fecha de hoy y borrarlos
    const deleteFutureAppointments = await AppointmentModel.deleteMany({
      //start: { $gte: dayjs().startOf("day").toDate() },
      businessID: req.params.businessID,
      status: "unbooked",
    });

    // generar nuevos turnos con los parametros nuevos
    if (updatedBusiness) await generateAppointments(updatedBusiness);
    return;
  }
};

export {
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
};
