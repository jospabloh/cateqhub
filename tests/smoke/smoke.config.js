// Per-app half of the shared smoke suite. smoke.spec.js next to this file is
// byte-identical across the portfolio — the canonical copy lives in
// `jospabloh/acacia-app-standard` → `shared/smoke/`. Change it there and copy
// it out; everything specific to this app belongs here instead.
export default {
  name: 'CateqHub',
  url: 'https://cateqhub.acaciaco.com.mx',

  // Verbatim from this repo's index.html — proves the deploy served THIS app
  // and not a stale or unrelated one.
  title: /CateqHub/,

  // Rutas PÚBLICAS extra para la quinta afirmación del módulo 12 —que el
  // selector de esquina no tape nada y nada lo tape, en los tres anchos—.
  // Hasta 2026-09-08 sólo se comprobaba el login, que es justo la pantalla
  // donde MENOS probable es que aparezca un segundo control de esquina: el
  // ejemplo del estándar avisa que suele salir en un registro, un reset o un
  // 404, que tienen su propio chrome. Las cuatro salen de src/App.jsx (líneas
  // 77-79 y el `path="*"`), no de copy adivinado.
  //
  // Las pantallas detrás del login siguen sin cubrirse: esta suite no guarda
  // credenciales a propósito. Ese hueco es real, lo nombra el módulo 12, y se
  // cierra mirándolas a mano en el primer deploy.
  routes: ['./', './register', './forgot-password', './no-such-page'],

  theme: {
    // Tailwind's `.dark` on <html>.
    kind: 'class',
    root: '[data-theme-switcher]',
  },
};
