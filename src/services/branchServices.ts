import { Request } from "express";
import BranchModel from "../models/branchModel";
import SubscriptionModel from "../models/subscriptionModel";
import AppointmentModel from "../models/appointmentModel";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import EmployeeModel from "../models/employeeModel";
import { getPlanLimits } from "../config/planLimits";

const SGetBranchesByBusiness = async ({ params }: Request) => {
  return BranchModel.find({ businessID: params.businessID, deletedAt: null });
};

const SCreateBranch = async ({ body }: Request) => {
  const subscription = await SubscriptionModel.findOne({ businessID: body.businessID });
  const { maxBranches } = getPlanLimits(subscription?.subscriptionType);
  if (maxBranches === 0) return "PLAN_REQUIRED";

  const activeCount = await BranchModel.countDocuments({ businessID: body.businessID, deletedAt: null });
  if (activeCount >= maxBranches) return "BRANCH_LIMIT_REACHED";

  const existing = await BranchModel.findOne({ businessID: body.businessID, name: body.name, deletedAt: null });
  if (existing) return "BRANCH_NAME_TAKEN";

  const branch = await BranchModel.create({
    businessID: body.businessID,
    ownerID: body.ownerID,
    name: body.name,
    street: body.street,
    number: body.number,
    city: body.city ?? null,
    province: body.province ?? null,
    phone: body.phone,
    email: body.email ?? null,
  });
  return branch;
};

const SEditBranch = async ({ body, params }: Request) => {
  if (body.name) {
    const existing = await BranchModel.findOne({
      businessID: body.businessID,
      name: body.name,
      deletedAt: null,
      _id: { $ne: params.branchID },
    });
    if (existing) return "BRANCH_NAME_TAKEN";
  }
  const allowedFields: Record<string, unknown> = {};
  if (body.name !== undefined) allowedFields.name = body.name;
  if (body.street !== undefined) allowedFields.street = body.street;
  if (body.number !== undefined) allowedFields.number = body.number;
  if (body.city !== undefined) allowedFields.city = body.city;
  if (body.province !== undefined) allowedFields.province = body.province;
  if (body.phone !== undefined) allowedFields.phone = body.phone;
  if (body.email !== undefined) allowedFields.email = body.email;

  const updated = await BranchModel.findOneAndUpdate(
    { _id: params.branchID, businessID: body.businessID, deletedAt: null },
    { $set: allowedFields },
    { new: true }
  );
  if (!updated) return "BRANCH_NOT_FOUND";
  return updated;
};

const SDeleteBranch = async ({ params, body }: Request) => {
  const branch = await BranchModel.findOneAndUpdate(
    { _id: params.branchID, businessID: body.businessID, deletedAt: null },
    { deletedAt: new Date() },
    { new: true }
  );
  if (!branch) return "BRANCH_NOT_FOUND";

  // Clear branchID from future appointments only (preserve history for stats)
  await AppointmentModel.updateMany(
    { branchID: params.branchID, start: { $gte: new Date() } },
    { $set: { branchID: null } }
  );

  // Clear branchID from schedule templates (they are not historical records)
  await AppointmentScheduleModel.updateMany(
    { branchID: params.branchID },
    { $set: { branchID: null } }
  );

  // Remove branch from all employees
  await EmployeeModel.updateMany(
    { branches: params.branchID },
    { $pull: { branches: params.branchID } }
  );

  return branch;
};

const SGetPublicBranchesByBusiness = async (businessID: string) => {
  return BranchModel.find({ businessID, deletedAt: null }).select("_id name street number city province");
};

export { SGetBranchesByBusiness, SCreateBranch, SEditBranch, SDeleteBranch, SGetPublicBranchesByBusiness };
