import dayjs from "dayjs";
import SubscriptionModel from "../models/subscriptionModel";

export const handlePlanExpiracy = async () => {
  const month = dayjs().month() + 1;
  const day = dayjs().date();

  const subscriptions = await SubscriptionModel.find({
    expiracyDay: day,
    expiracyMonth: month,
  });
  if (subscriptions.length === 0) {
    return console.log(
      `SUBSCRIPTION EXPIRACY FUNCTION EXECUTED SUCCESSFULLY ON DATE ${day}/${month}. NO SUBSCRIPTIONS EXPIRED.`
    );
  }
  for (let i = 0; i < subscriptions.length; i++) {
    try {
      const expiredSubscriptions = await SubscriptionModel.findByIdAndUpdate(
        subscriptions[i]._id,
        { subscriptionType: "SC_EXPIRED" }
      );
      console.log(
        `SUBSCRIPTION EXPIRACY FUNCTION EXECUTED SUCCESSFULLY ON DATE ${day}/${month}`
      );
      console.log("EXPIRED SUBSCRIPTIONS: ", expiredSubscriptions);
    } catch (error) {
      console.log(`ERROR EXECUTING SUBSCRIPTION EXPIRACY FUNCTION ON DATE ${day}/${month}`);
    }
  }
};
