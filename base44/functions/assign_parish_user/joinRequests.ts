// Lógica pura de las solicitudes para unirse a una parroquia con código.
// Vive aparte de entry.ts, sin imports, por dos razones: Base44 aísla cada
// directorio de función (no se puede compartir con otra) y así `node --test`
// (tests/unit/joinRequests.test.js) la carga tal cual, sin Deno ni el SDK.
//
// El modelo: un código NO da acceso. Sólo abre una solicitud PENDIENTE; el
// administrador de la parroquia la aprueba eligiendo el rol, y sólo entonces
// entry.ts escribe parish_id/parish_role. Todo lo que decide una escritura
// (rol, parroquia, pertenencia) se valida aquí contra el registro ALMACENADO,
// nunca contra lo que mande el cuerpo.

// Roles que un administrador puede repartir al aprobar. Es el enum de
// User.parish_role y NUNCA incluye el rol de plataforma (`role: admin`): ése lo
// pone Base44, no una solicitud.
export const ASSIGNABLE_ROLES = ['catequist', 'admin'];

// Sin I, L, O, 0 ni 1: el código se dicta por WhatsApp o se copia de una foto.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 8;

// `rand(n)` devuelve n bytes aleatorios; entry.ts pasa crypto.getRandomValues.
// Módulo 256 sobre un alfabeto de 31 sesga un poco; para un código que además
// exige aprobación del administrador no importa, y evita un bucle de rechazo.
export function generateJoinCode(rand: (n: number) => Uint8Array): string {
  const bytes = rand(JOIN_CODE_LENGTH);
  let raw = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) raw += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// Acepta minúsculas, espacios y guion opcional ("abcd efgh", "ABCDEFGH").
// Devuelve la forma guardada ("ABCD-EFGH") o null si no puede ser un código.
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== JOIN_CODE_LENGTH) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// El rol elegido al aprobar es obligatorio y de la lista blanca: sin valor por
// defecto, para que el administrador decida a propósito en vez de aprobar a
// alguien como catequista por omisión (o como administrador por un descuido).
export function resolveApprovalRole(input: unknown): string | null {
  return typeof input === 'string' && ASSIGNABLE_ROLES.includes(input) ? input : null;
}

type StoredRequest = { parish_id?: string; status?: string } | null | undefined;

export type DecisionGate =
  | { ok: true }
  | { ok: false; status: number; error: string; code: string };

// ¿Puede quien llama resolver ESTA solicitud? Se evalúa contra la solicitud
// releída del servidor. Una ajena responde igual que una inexistente (404), para
// que el endpoint no sirva de oráculo de ids de otras parroquias.
export function checkRequestDecision(
  request: StoredRequest,
  caller: { parishId?: string; isPlatformAdmin: boolean },
): DecisionGate {
  const notFound = { ok: false as const, status: 404, error: 'Solicitud no encontrada', code: 'not_found' };
  if (!request) return notFound;
  if (!caller.isPlatformAdmin && (!caller.parishId || request.parish_id !== caller.parishId)) return notFound;
  if (request.status !== 'pending') {
    return { ok: false, status: 409, error: 'Esta solicitud ya fue resuelta', code: 'already_decided' };
  }
  return { ok: true };
}
