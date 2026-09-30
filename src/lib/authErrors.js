// Errores de autenticación en un solo sitio: Login y Register los comparten
// (VerifyEmailStep), y la plataforma responde en inglés, así que la traducción
// no puede vivir repetida en cada pantalla.

// Base44 exige un correo verificado antes de dejar entrar con contraseña. Si la
// persona se registró y nunca escribió el código (o lo perdió), el login
// responde con un mensaje de "verify your email" / "verification code": eso no
// es una contraseña mala, y mostrarlo crudo la deja sin saber dónde escribir el
// código. Se detecta por el texto porque la plataforma no manda un código de
// error estable.
export const needsEmailVerification = (error) =>
  /verify your email|verification code|email (is )?not verified|not verified/i.test(error?.message || "");

const statusOf = (error) => error?.status ?? error?.response?.status;

// verifyOtp: casi siempre es código equivocado o vencido. Un 429 es otra cosa
// (demasiados intentos) y decirle "código inválido" lo llevaría a reintentar.
export function verifyOtpMessage(error) {
  if (statusOf(error) === 429 || /too many|rate limit/i.test(error?.message || "")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  return "Código inválido o vencido. Revisa el código o pide uno nuevo.";
}

export function resendOtpMessage(error) {
  if (statusOf(error) === 429 || /too many|rate limit/i.test(error?.message || "")) {
    return "Ya te enviamos un código hace poco. Espera un momento antes de pedir otro.";
  }
  return "No se pudo reenviar el código. Intenta de nuevo en un momento.";
}
