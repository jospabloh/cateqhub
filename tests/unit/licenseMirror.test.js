// El espejo de licencia en User es lo que la RLS de Child/Group/Attendance/
// Guardian/ChildGuardian lee, porque Base44 no puede consultar otra fila. Un
// campo AUSENTE no iguala a nada: la cuenta no lee un solo niño y no hay error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseMirrorPatch } from '../../base44/functions/session/licenseMirror.ts';

const parishOld = {}; // creada antes de que existieran plan/license_status

test('una cuenta sin espejo se repara con lo que dice SU parroquia', () => {
  const p = licenseMirrorPatch({}, { plan: 'premium', license_status: 'read_only', support_priority_addon: true });
  assert.equal(p.parish_license_status, 'read_only', 'copia el estado real, no asume active');
  assert.equal(p.parish_support_priority_addon, true);
});

test('una parroquia vieja sin campos resuelve a premium/active, nunca a free', () => {
  const p = licenseMirrorPatch({}, parishOld);
  assert.equal(p.parish_plan, 'premium');
  assert.equal(p.parish_license_status, 'active');
  assert.notEqual(p.parish_plan, 'free', 'el plan gratuito se retiró en la 1.10.0');
});

test('si no se puede leer la parroquia no se asume nada', () => {
  // Asumir "active" ante un error transitorio le abriría acceso a una parroquia
  // que quizá está access_denied.
  assert.equal(licenseMirrorPatch({}, null), null);
  assert.equal(licenseMirrorPatch({}, undefined), null);
});

test('una cuenta con el espejo completo no se toca', () => {
  const user = { parish_plan: 'premium', parish_license_status: 'read_only' };
  assert.equal(licenseMirrorPatch(user, { plan: 'premium', license_status: 'active' }), null);
});

test('basta que falte UNO de los dos campos', () => {
  assert.ok(licenseMirrorPatch({ parish_plan: 'premium' }, parishOld));
  assert.ok(licenseMirrorPatch({ parish_license_status: 'active' }, parishOld));
});
