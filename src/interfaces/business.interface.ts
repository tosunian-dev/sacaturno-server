export interface IBusiness {
  ownerID: string;
  name: string;
  businessType: string;
  address?: string;
  phone: number;
  image: string;
  _id?: string;
  email: string;
  subscription?: string;
  slug: string;
  scheduleEnd: Date | null;
  scheduleAnticipation: number;
  scheduleDaysToCreate: number;
  automaticSchedule: boolean;
  mpAccessToken?: string | null;
  mpRefreshToken?: string | null;
  mpLinked?: boolean;
  mpAccountName?: string | null;
  mpAccountEmail?: string | null;
  bookingsEnabled?: boolean;
}
