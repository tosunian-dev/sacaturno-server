export interface IPlanPayment {
  _id: string;
  userID: string;
  businessID: string;
  email: string;
  paymentDate: Date;
  price: number;
  subscriptionType: string;
  mpPaymentID: string;
}
