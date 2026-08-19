// Escapa los metacaracteres de una expresión regular para que el input del
// usuario se trate como TEXTO LITERAL y no como patrón. Sin esto:
//   - un input como "(" rompe `new RegExp(...)` (SyntaxError → 500),
//   - un patrón como "(a+)+$" causa backtracking catastrófico (ReDoS) que Mongo
//     evalúa contra cada documento, clavando la CPU de la base,
//   - un patrón como ".*" hace match con todo, filtrando la colección entera.
// Además recorta el input a `maxLen` para acotar el costo de la evaluación y
// coacciona a string: si llega un objeto (inyección NoSQL vía body/query),
// termina en "" en vez de convertirse en un operador de Mongo.
export const escapeRegExp = (input: unknown, maxLen = 100): string => {
  const s = typeof input === "string" ? input : "";
  return s.slice(0, maxLen).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
