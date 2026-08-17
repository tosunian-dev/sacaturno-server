export interface IBranch {
  _id?: string;
  businessID: string;
  ownerID: string;
  name: string;
  street: string;
  number: string;
  city?: string;
  province?: string;
  phone?: number | null;
  email?: string;
  deletedAt?: Date | null;
}
