// El validador de RLS exige que JoinRequest sea sólo de servicio en sus cuatro
// operaciones. Se prueba que de verdad falla (un validador que nunca falla no
// protege nada) y que el archivo real pasa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRlsErrors } from '../../scripts/lib/entity-rls-rules.mjs';

const ADMIN = { user_condition: { role: 'admin' } };
const write = (dir, rls) =>
  writeFileSync(join(dir, 'JoinRequest.jsonc'), JSON.stringify({ name: 'JoinRequest', properties: { parish_id: { type: 'string' } }, rls }));

test('JoinRequest real: pasa y es sólo de servicio en las 4 operaciones', () => {
  const dir = new URL('../../base44/entities/', import.meta.url).pathname;
  assert.deepEqual(collectRlsErrors(dir).errors, []);
  const schema = JSON.parse(readFileSync(join(dir, 'JoinRequest.jsonc'), 'utf8'));
  for (const op of ['create', 'read', 'update', 'delete']) assert.deepEqual(schema.rls[op], ADMIN, op);
});

test('el validador rechaza una operación abierta a la parroquia', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rls-'));
  write(dir, { create: ADMIN, read: ADMIN, update: ADMIN, delete: { $or: [{ 'data.parish_id': '{{user.data.parish_id}}' }, ADMIN] } });
  const { errors } = collectRlsErrors(dir);
  assert.ok(errors.some((e) => e.includes('JoinRequest [delete]')), errors.join('\n'));
});

test('el validador rechaza una operación ausente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rls-'));
  write(dir, { create: ADMIN, read: ADMIN, update: ADMIN });
  assert.ok(collectRlsErrors(dir).errors.some((e) => e.includes('JoinRequest [delete]')));
});
