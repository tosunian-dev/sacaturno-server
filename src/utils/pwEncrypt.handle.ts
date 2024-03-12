import { hash, compare } from "bcryptjs"

const encrypt = async (password: string) => {
    const pwHashed = await hash(password, 7)
    return pwHashed
}

const verify = async (password: string, pwHashed: string) => {
    const checkPw = await compare(password, pwHashed)
    return checkPw
}

export {
    encrypt,
    verify
}
