// Negocios y sucursales guardan el domicilio con los mismos campos, así que se
// componen igual en todos lados. Espejo de composeBranchAddress del frontend.
export const composeAddress = (place?: {
  street?: string | null;
  number?: string | null;
  city?: string | null;
}): string => {
  if (!place) return "";
  const line1 = [place.street, place.number].filter(Boolean).join(" ");
  return [line1, place.city].filter(Boolean).join(", ");
};
