export type EmployeePermission =
  | "manage_own_appointments"
  | "manage_all_appointments"
  | "view_stats"
  | "manage_services"
  | "manage_schedule";

export interface IEmployee {
  _id?: string;
  businessID: string;
  ownerID: string;
  userID?: string | null;
  name: string;
  surname: string;
  email: string;
  status: "pending" | "active" | "inactive";
  invitationToken?: string | null;
  invitationExpiry?: Date | null;
  permissions?: EmployeePermission[];
  branches?: string[];
  services?: string[];
}
