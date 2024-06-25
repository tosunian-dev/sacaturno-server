export interface IUser {
    name: string,
    email: string,
    phone?: number,
    password: string,
    _id?: string,
    profileImage?: string,
    verified?: boolean,
    birthdate: Date
}