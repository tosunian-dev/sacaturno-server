export interface IBusiness {
  ownerID: string;
  name: string;
  businessType: string;
  address: string;
  phone: number;
  image: string;
  _id?: string;
  email: string;
  subscription?: string;
  slug: string;
  scheduleEnd: Date;
  scheduleAnticipation: number;
  scheduleDaysToCreate: number;
  automaticSchedule: boolean;
}
