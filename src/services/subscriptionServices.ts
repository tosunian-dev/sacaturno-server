import { Request, Response } from "express";
import SubscriptionModel from "../models/subscriptionModel";

const SGetSubscriptionByBusinessID = async ({params}: Request) => {
    const subscriptionData = await SubscriptionModel.findOne({businessID: params.businessID})
    if(!subscriptionData){
        return 'SUBSCRIPTION_NOT_FOUND'
    }
    return subscriptionData
}
const SGetSubscriptionByOwnerID = async ({params}: Request) => {
    const subscriptionData = await SubscriptionModel.findOne({ownerID: params.ownerID})
    if(!subscriptionData){
        return 'SUBSCRIPTION_NOT_FOUND'
    }
    return subscriptionData
}

export {
    SGetSubscriptionByOwnerID,
    SGetSubscriptionByBusinessID
}