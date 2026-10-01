import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsEmailVerification, verifyOtpMessage, resendOtpMessage } from '../../src/lib/authErrors.js';

test('needsEmailVerification: reconoce los mensajes de correo sin verificar', () => {
  for (const m of [
    'Please verify your email before logging in',
    'Email not verified',
    'Enter the verification code sent to your email',
    'VERIFY YOUR EMAIL',
  ]) assert.equal(needsEmailVerification({ message: m }), true, m);
});

test('needsEmailVerification: otros errores de login conservan su mensaje', () => {
  for (const e of [{ message: 'Invalid credentials' }, { message: 'Too many requests' }, { message: '' }, {}, null, undefined]) {
    assert.equal(needsEmailVerification(e), false, JSON.stringify(e));
  }
});

test('verifyOtpMessage / resendOtpMessage: siempre en español, 429 distinto', () => {
  assert.match(verifyOtpMessage({ message: 'Invalid OTP' }), /Código inválido o vencido/);
  assert.match(verifyOtpMessage({ status: 429 }), /Demasiados intentos/);
  assert.match(verifyOtpMessage({ response: { status: 429 } }), /Demasiados intentos/);
  assert.match(resendOtpMessage({ message: 'boom' }), /No se pudo reenviar/);
  assert.match(resendOtpMessage({ message: 'rate limit exceeded' }), /Espera un momento/);
  for (const m of [verifyOtpMessage(null), resendOtpMessage(undefined)]) assert.ok(!m.includes('—'));
});
