import { FilterQuery } from "mongoose";
import EmployeeModel from "../models/employeeModel";
import { JwtContextPayload } from "./jwtGen.handle";

// Recorte de la agenda para un empleado sin "manage_all_appointments". Los turnos
// ajenos traen datos personales del cliente (nombre, email, teléfono) que no le
// corresponden, así que el filtro va en la query y no en el cliente: filtrar sólo
// en React igual manda la PII al browser.
//
// Ve los suyos y los libres sin asignar de sus sucursales — esos últimos son los
// que puede tomar para sí, esconderlos le sacaría el flujo de "reclamar turno".
//
// Devuelve null cuando no hay nada que recortar (dueño, o empleado que administra
// toda la agenda) para que el caller no toque su query.
export const employeeAgendaScope = async (
  user: JwtContextPayload | undefined
): Promise<FilterQuery<any> | null> => {
  if (user?.role !== "employee" || !user.employeeID) return null;

  const employee = await EmployeeModel.findById(user.employeeID).select(
    "permissions status branches"
  );
  const canViewAll =
    employee?.status === "active" &&
    (employee.permissions ?? []).includes("manage_all_appointments");
  if (canViewAll) return null;

  const branches = employee?.branches ?? [];
  // Sin sucursales configuradas no hay recorte por sucursal: el negocio puede no
  // usarlas y entonces todos sus turnos tienen branchID null.
  const unassigned: FilterQuery<any> = branches.length
    ? { employeeID: null, branchID: { $in: [...branches, null] } }
    : { employeeID: null };

  return { $or: [{ employeeID: user.employeeID }, unassigned] };
};
