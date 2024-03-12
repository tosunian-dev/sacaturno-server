export interface IImage{
    file_name: string;
    type: 'USER_PROFILE_IMAGE' | 'BUSINESS_PROFILE_IMAGE';
    userId: string;
}