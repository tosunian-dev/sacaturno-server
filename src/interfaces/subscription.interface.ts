export default interface ISubscription {
  businessID: string | undefined;
  ownerID: string | undefined;
  subscriptionType: "SC_FREE" | "SC_FULL" | "SC_EXPIRED";
  paymentDate: Date;
  expiracyDate: Date;
  expiracyDay?: number,
  expiracyMonth?: number
}
