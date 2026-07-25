import { Response } from "express"

const handleError = (res: Response, error: string, err?: unknown) => {
    console.error(`[${error}]`, err);
    res.status(500).send({error})
}

export {
    handleError
}