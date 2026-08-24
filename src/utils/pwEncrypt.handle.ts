import { hash, compare, getRounds, hashSync } from "bcryptjs"

// Cost factor de bcrypt: cada +1 duplica el trabajo (2^N iteraciones). Protege
// contra ataques offline sobre un dump de la base, donde el rate limiting no
// aplica. Era 7 (24ms aprox por hash); 10 es el default de bcrypt (aprox 78ms).
const BCRYPT_COST = 10

// Hash "señuelo" precomputado una vez al arrancar. En el login, cuando el email
// no existe, se compara la contraseña contra este hash para gastar el mismo
// tiempo de bcrypt que un login con usuario real. Sin esto, "usuario inexistente"
// respondería ~78ms más rápido que "contraseña incorrecta", delatando qué
// cuentas existen por el reloj (timing attack), aun con el mensaje unificado.
const DUMMY_HASH = hashSync("sacaturno-timing-attack-dummy-value", BCRYPT_COST)

const encrypt = async (password: string) => {
    const pwHashed = await hash(password, BCRYPT_COST)
    return pwHashed
}

const verify = async (password: string, pwHashed: string) => {
    const checkPw = await compare(password, pwHashed)
    return checkPw
}

// El costo viaja dentro del hash, así que los hashes viejos siguen validando.
// Esto detecta los que quedaron por debajo del costo actual para regenerarlos
// en el próximo login exitoso, único momento en que tenemos la password en claro.
const needsRehash = (pwHashed: string) => {
    try {
        return getRounds(pwHashed) < BCRYPT_COST
    } catch {
        // Hash con formato no reconocido: no arriesgamos tocarlo.
        return false
    }
}

export {
    encrypt,
    verify,
    needsRehash,
    BCRYPT_COST,
    DUMMY_HASH
}
