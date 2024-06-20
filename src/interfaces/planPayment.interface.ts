export interface IPlanPayment {
    userID: string,
    businessID :string,
    email: string,
    paymentDate: Date,
    price: number,
    subscriptionType: string
}