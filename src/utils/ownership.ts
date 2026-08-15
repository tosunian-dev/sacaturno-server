import { isValidObjectId, Model } from "mongoose";
import BusinessModel from "../models/businessModel";
import { JwtContextPayload } from "./jwtGen.handle";

// ¿El usuario autenticado (dueño o empleado) puede operar sobre este negocio?
//
// - Si el token trae `businessID` (empleado, o dueño que ya eligió contexto),
//   alcanza con comparar: ese token se emitió DESPUÉS de verificar la pertenencia
//   en /employee/select-context.
// - Si no lo trae (dueño recién onboardeado: su context token base se emite antes
//   de crear el negocio), se resuelve contra la base: el negocio debe tener
//   ownerID === userId.
//
// Devuelve false ante cualquier duda (sin usuario, sin businessID, id inválido).
export const userCanAccessBusiness = async (
  user: JwtContextPayload | undefined,
  businessID: string | null | undefined
): Promise<boolean> => {
  if (!user || !businessID) return false;

  if (user.businessID) {
    return String(user.businessID) === String(businessID);
  }

  if (!isValidObjectId(businessID)) return false;
  const business = await BusinessModel.findOne({
    _id: businessID,
    ownerID: user.userId,
  }).select("_id");
  return !!business;
};

// Resuelve el businessID real de un recurso desde la base (nunca desde el body,
// que el cliente controla). Devuelve null si el recurso no existe.
export const resolveBusinessID = async (
  model: Model<any>,
  id: string | undefined | null
): Promise<string | null> => {
  if (!id || !isValidObjectId(id)) return null;
  const doc = await model.findById(id).select("businessID");
  return doc?.businessID ? String(doc.businessID) : null;
};

// Igual que resolveBusinessID pero para una lista de ids: devuelve el conjunto de
// businessIDs distintos que tocan esos documentos. Sirve para las operaciones en
// lote (asignación/edición masiva), donde hay que exigir que TODO pertenezca al
// mismo negocio del usuario.
export const distinctBusinessIDs = async (
  model: Model<any>,
  ids: string[]
): Promise<string[]> => {
  const valid = (ids ?? []).filter((id) => isValidObjectId(id));
  if (valid.length === 0) return [];
  const docs = await model.find({ _id: { $in: valid } }).select("businessID");
  // Array.from y no spread: el build del frontend type-checkea también /server
  // con target ES5, donde iterar un Set exige downlevelIteration.
  return Array.from(new Set(docs.map((d: any) => String(d.businessID))));
};
