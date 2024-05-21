import dayjs from "dayjs";
import SubscriptionModel from "../models/subscriptionModel";

export const handlePlanExpiracy = async () => {
  const month = dayjs().month() + 1;
  const day = dayjs().date();

  const subscriptions = await SubscriptionModel.find({
    expiracyDay: day,
    expiracyMonth: month,
  });
  for (let i = 0; i < subscriptions.length; i++) {
    try {
      const expiredSubscriptions = await SubscriptionModel.findByIdAndUpdate(
        subscriptions[i]._id,
        { subscriptionType: "SC_EXPIRED" }
      );
      console.log("EXPIRED SUBSCRIPTIONS: ", expiredSubscriptions);
      console.log(
        `EXPIRACY FUNCTION EXECUTED SUCCESSFULLY ON DATE ${day}/${month}`
      );
    } catch (error) {
      console.log("ERROR_EXPIRACY_FUNCTION");
    }
  }
};
