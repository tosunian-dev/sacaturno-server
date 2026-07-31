import EmployeeModel from "../models/employeeModel";
import { EmployeePermission } from "../interfaces/employee.interface";

export const hasPermission = async (
  employeeID: string,
  permission: EmployeePermission
): Promise<boolean> => {
  const employee = await EmployeeModel.findById(employeeID).select("permissions status");
  if (!employee || employee.status !== "active") return false;
  return (employee.permissions ?? []).includes(permission);
};
