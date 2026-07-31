export default interface ISubscription {
  businessID: string | undefined;
  ownerID: string | undefined;
  subscriptionType: "SC_FREE" | "SC_BASIC" | "SC_PRO" | "SC_FULL" | "SC_EXPIRED";
  paymentDate: Date;
  expiracyDate: Date;
  expiryReminderSentAt?: Date;
  updatedAt?: Date
}
