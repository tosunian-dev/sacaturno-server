export interface IService {
  _id?: string;
  businessID: string;
  name: string;
  ownerID?: string;
  price: number;
  description: string;
  duration?: number;
  depositAmount?: number; // 0 o undefined = sin seña
}
