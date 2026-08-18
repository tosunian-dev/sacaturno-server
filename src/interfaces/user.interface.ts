export interface IUser {
    name: string,
    surname: string,
    email: string,
    phone?: number,
    password?: string,
    googleId?: string,
    authProvider?: "local" | "google",
    _id?: string,
    profileImage?: string,
    profileImagePublicId?: string,
    verified?: boolean,
    isFirstLogin?: boolean
}