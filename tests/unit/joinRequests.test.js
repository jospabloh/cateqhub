// Solicitudes para unirse por código: la lógica pura de
// base44/functions/assign_parish_user/joinRequests.ts (sin imports, así que
// node la carga directo con type-stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ASSIGNABLE_ROLES,
  JOIN_CODE_LENGTH,
  generateJoinCode,
  normalizeJoinCode,
  resolveApprovalRole,
  checkRequestDecision,
} from '../../base44/functions/assign_parish_user/joinRequests.ts';

const bytes = (fill) => (n) => Uint8Array.from({ length: n }, (_, i) => fill(i));

test('generateJoinCode: 8 caracteres en dos bloques, sin caracteres ambiguos', () => {
  for (let seed = 0; seed < 50; seed++) {
    const code = generateJoinCode(bytes((i) => (seed * 37 + i * 91) % 256));
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    assert.equal(code.replace('-', '').length, JOIN_CODE_LENGTH);
  }
});

test('normalizeJoinCode: acepta minúsculas, espacios y sin guion', () => {
  assert.equal(normalizeJoinCode('abcd-efgh'), 'ABCD-EFGH');
  assert.equal(normalizeJoinCode(' abcd efgh '), 'ABCD-EFGH');
  assert.equal(normalizeJoinCode('ABCDEFGH'), 'ABCD-EFGH');
});

test('normalizeJoinCode: rechaza lo que no puede ser un código', () => {
  for (const bad of ['', 'ABCD', 'ABCD-EFG', 'ABCD-EFGHJ', 'ABCD-EFG0', 'ABCD-EFGI', null, undefined, 12345678, {}]) {
    assert.equal(normalizeJoinCode(bad), null, String(bad));
  }
});

test('un código generado sobrevive a normalizeJoinCode', () => {
  const code = generateJoinCode(bytes((i) => i * 29));
  assert.equal(normalizeJoinCode(code), code);
  assert.equal(normalizeJoinCode(code.toLowerCase()), code);
});

test('resolveApprovalRole: lista blanca, sin valor por defecto, nunca rol de plataforma', () => {
  assert.deepEqual(ASSIGNABLE_ROLES, ['catequist', 'admin']);
  assert.equal(resolveApprovalRole('catequist'), 'catequist');
  assert.equal(resolveApprovalRole('admin'), 'admin');
  for (const bad of [undefined, null, '', 'user', 'owner', 'ADMIN', 'platform', ['admin'], { role: 'admin' }]) {
    assert.equal(resolveApprovalRole(bad), null, String(bad));
  }
});

test('checkRequestDecision: un admin resuelve sólo solicitudes pendientes de su parroquia', () => {
  const caller = { parishId: 'p1', isPlatformAdmin: false };
  assert.deepEqual(checkRequestDecision({ parish_id: 'p1', status: 'pending' }, caller), { ok: true });
});

test('checkRequestDecision: inexistente y ajena responden igual (sin oráculo)', () => {
  const caller = { parishId: 'p1', isPlatformAdmin: false };
  const missing = checkRequestDecision(null, caller);
  const foreign = checkRequestDecision({ parish_id: 'p2', status: 'pending' }, caller);
  assert.equal(missing.ok, false);
  assert.deepEqual(foreign, missing);
  assert.equal(foreign.status, 404);
});

test('checkRequestDecision: quien no tiene parroquia no resuelve nada', () => {
  const r = checkRequestDecision({ parish_id: 'p1', status: 'pending' }, { parishId: '', isPlatformAdmin: false });
  assert.equal(r.ok, false);
  assert.equal(r.status, 404);
});

test('checkRequestDecision: una solicitud ya resuelta da 409', () => {
  for (const status of ['approved', 'rejected', 'cancelled']) {
    const r = checkRequestDecision({ parish_id: 'p1', status }, { parishId: 'p1', isPlatformAdmin: false });
    assert.equal(r.ok, false);
    assert.equal(r.status, 409);
    assert.equal(r.code, 'already_decided');
  }
});

test('checkRequestDecision: el admin de plataforma puede con cualquier parroquia', () => {
  assert.deepEqual(
    checkRequestDecision({ parish_id: 'p9', status: 'pending' }, { parishId: undefined, isPlatformAdmin: true }),
    { ok: true },
  );
});

// El camino de aprobación es el ÚNICO que escribe parish_id/parish_role por
// una solicitud. Esta prueba lee el archivo para que un cambio que lo salte
// (p. ej. escribir el User en `join`) falle aquí y no en producción.
test('entry.ts: `join` sólo crea la solicitud, jamás escribe el User', () => {
  const src = readFileSync(new URL('../../base44/functions/assign_parish_user/entry.ts', import.meta.url), 'utf8');
  const start = src.indexOf("body.action === 'join'");
  const end = src.indexOf("body.action === 'join_status'");
  assert.ok(start > 0 && end > start, 'no se encontró el bloque de join');
  const block = src.slice(start, end);
  assert.ok(block.includes('JoinRequest.create'));
  assert.ok(!/entities\.User\.update/.test(block), 'join no debe escribir el User');
});
