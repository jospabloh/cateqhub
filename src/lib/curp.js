// Validación de formato de CURP (México). Cubre nacidos en México y en el
// extranjero (entidad "NE", para residentes). Es una validación de formato
// —no verifica contra RENAPO— pensada para detectar errores de captura.
const CURP_PATTERN =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QO|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d$/;

export function normalizeCurp(value) {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Vacío se considera válido: el campo es opcional.
export function isValidCurp(value) {
  const v = normalizeCurp(value);
  if (!v) return true;
  return CURP_PATTERN.test(v);
}
