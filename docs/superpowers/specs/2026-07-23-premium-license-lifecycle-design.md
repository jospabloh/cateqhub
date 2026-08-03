# Diseño — Ciclo de vida de licencia Premium, aviso de privacidad y certificaciones

> **⚠️ Actualización 2026-08-03:** los umbrales de días (15 días activo→read_only,
> 15 más read_only→access_denied, 30 más access_denied→deletion_eligible)
> descritos abajo cambiaron — Mission Control migró CateqHub a su ciclo
> acumulado unificado 8/15/30/45 (directiva "no exceptions" del owner de la
> plataforma). Ningún código de este repo cambia (la lógica del cron y el
> endpoint de borrado viven enteramente en `acacia-mission-control`) — solo
> cambia CUÁNDO se dispara cada etapa. Ver
> `docs/superpowers/specs/2026-08-03-portfolio-license-lifecycle-design.md` en
> `acacia-mission-control` para el detalle.

**Fecha:** 2026-07-23
**Rama:** `claude/asistencia-licencias-datos-sensibles-52jhi2`
**Repo hermano:** `jospabloh/acacia-mission-control` (ver
`docs/superpowers/specs/2026-07-23-cateqhub-premium-license-lifecycle-design.md`
en ese repo para el cron, el endpoint de borrado y la config de licencia)

## Problema

1. **Sin enforcement real de Premium.** `Guardian`/`ChildGuardian` (Tutores)
   son la única función de pago hoy. La restricción es **solo de UI**
   (`ChildDetail.jsx:125`, botón deshabilitado) — la RLS de ambas entidades
   solo valida `parish_id`, así que cualquier llamada directa a la API puede
   crear/editar Tutores en una parroquia gratuita. Esto se corrige en este
   diseño junto con el ciclo de vida (mismo mecanismo).
2. **Sin manejo de impago.** Si una parroquia Premium deja de pagar, nada
   cambia — acceso completo indefinido.
3. **Sin aviso de privacidad** para datos sensibles de menores (CURP, nombre,
   fecha de nacimiento en `Child`/`Guardian`) — obligatorio bajo la LFPDPPP
   mexicana.
4. **"Acerca de" no menciona ninguna certificación** del proveedor de
   infraestructura (Base44).

## Contexto: qué ya existe

- `Parish` (tenant): hoy solo `name`, `admin_contact`, `active`, `plan`
  (`free|premium`, default `free`, ver commit `ee7827e` — CateqHub eliminó el
  concepto de trial hace unas horas; **no reintroducir vencimientos de
  prueba**, solo Premium tiene ciclo de pago).
- `create_parish` (función, service-role): único punto donde nace una
  parroquia y su primer admin. Punto natural para el gate de aceptación.
- Base44 RLS **no soporta lookups entre entidades** — confirmado contra la
  doc local del skill `base44-cli` y contra el propio repo, que ya usa el
  workaround (`SupportTicketMessage.parish_id`, "Denormalizado, para RLS").
  Este diseño espeja `plan`/`license_status` de `Parish` hacia `User` con el
  mismo patrón.
- `acaciaControl` (puente HMAC ya desplegado) es el único canal de escritura
  de Mission Control hacia esta app.
- No existe ninguna librería de export (csv/xlsx) en `package.json` — se usa
  descarga de JSON nativa del navegador (`Blob`/`URL.createObjectURL`), cero
  dependencias nuevas.

## Decisiones (confirmadas con el usuario)

1. **Alcance: solo Premium.** El núcleo gratis (niños, grupos, asistencia QR,
   reportes) nunca se toca — sigue disponible siempre, incluso si Premium
   está en `deletion_eligible`.
2. **Plazos**: `active` →(15 días sin pago confirmado)→ `read_only`
   →(15 días)→ `access_denied` →(30 días con recordatorios y evidencia de
   auditoría)→ `deletion_eligible` (nunca borrado automático — requiere
   confirmación humana desde Mission Control, ver spec hermano).
3. **Exportación: autoservicio dentro de la app**, con checkbox de
   confirmación explícita.
4. **Consentimiento**: pantalla única para el admin de parroquia, en la
   creación de la parroquia (gate duro, no se puede crear sin aceptar),
   versionado.
5. **`read_only` vs `access_denied` — diferencia real, no solo cosmética**:
   - `read_only`: crear/editar Tutores bloqueado; **ver** los que ya existen
     sigue disponible (paridad con el downgrade voluntario a gratis que ya
     existe hoy).
   - `access_denied`: **además** se bloquea la lectura de Tutores — la
     pantalla se reemplaza por la de exportación. Este es el paso que
     realmente "niega acceso" que pidió el usuario.
   - Eliminar Tutores manualmente sigue permitido en cualquier estado (igual
     que el downgrade voluntario).

## Modelo de datos

### `Parish` — campos nuevos

```jsonc
"license_status": {
  "type": "string", "title": "Estado de licencia Premium",
  "enum": ["active", "read_only", "access_denied", "deletion_eligible"],
  "default": "active",
  "description": "Solo aplica mientras plan=premium. Lo escribe Mission Control (rol de servicio) vía el puente acaciaControl — nunca a mano desde el panel de Base44 (rompería el espejo en User, ver más abajo).",
  "rls": { "write": { "user_condition": { "role": "admin" } } }
},
"premium_period_end_at": { "type": "string", "format": "date-time", "title": "Fin del periodo Premium pagado",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"read_only_since":       { "type": "string", "format": "date-time", "title": "Desde cuándo está en solo lectura",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"access_denied_since":   { "type": "string", "format": "date-time", "title": "Desde cuándo se denegó el acceso",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"deletion_eligible_since": { "type": "string", "format": "date-time", "title": "Desde cuándo es candidata a borrado",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"export_confirmed_at":   { "type": "string", "format": "date-time", "title": "Exportación de datos confirmada",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"export_confirmed_by":   { "type": "string", "title": "Quién confirmó la exportación",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"data_processing_accepted_at":     { "type": "string", "format": "date-time", "title": "Aviso de privacidad aceptado" },
"data_processing_accepted_by":     { "type": "string", "title": "Quién aceptó (email)" },
"data_processing_terms_version":   { "type": "string", "title": "Versión del aviso aceptado" }
```

`export_confirmed_at`/`export_confirmed_by` necesitan FLS explícito de
solo-servicio (`"rls": { "write": { "user_condition": { "role": "admin" } } }`,
igual que los demás campos de licencia), porque la RLS de `update` en `Parish`
ya permite a un admin de parroquia editar su propio registro (hoy para
`name`/`admin_contact`) — sin ese FLS, un admin de parroquia podría escribir
estos dos campos directamente y falsificar una confirmación de exportación
que nunca ocurrió. Con el FLS puesto, el único camino de escritura válido es
la función `confirm_premium_export` (vía `asServiceRole`), que sí valida
`license_status === 'access_denied'` antes de estampar.

### `User` — campos espejo nuevos (para RLS de `Guardian`/`ChildGuardian`)

```jsonc
"parish_plan": { "type": "string", "title": "Plan de la parroquia (espejo)",
  "description": "Espejo de Parish.plan, mantenido por el puente acaciaControl y por assign_parish_user/create_parish. No confundir con el plan real (fuente de verdad = Parish.plan).",
  "rls": { "write": { "user_condition": { "role": "admin" } } } },
"parish_license_status": { "type": "string", "title": "Estado de licencia (espejo)",
  "description": "Espejo de Parish.license_status. Mismo mecanismo que parish_plan.",
  "rls": { "write": { "user_condition": { "role": "admin" } } } }
```

**Quién mantiene el espejo sincronizado:**
- `create_parish`: al crear la parroquia, estampa `parish_plan: 'free'`,
  `parish_license_status: 'active'` en el primer admin.
- `assign_parish_user`: al asignar un usuario existente a una parroquia,
  copia el `plan`/`license_status` actuales de esa `Parish` al nuevo usuario.
- Puente `acaciaControl`, acción `license.set` con `params.mirror` (ver spec
  hermano §2) — Mission Control es la única vía prevista para cambiar
  `Parish.plan`/`license_status` después de la creación; por eso el
  `description` del campo lo dice explícitamente. Editar `plan` a mano desde
  el panel de Base44 seguiría siendo técnicamente posible (rol de servicio) y
  dejaría el espejo desincronizado — riesgo aceptado y documentado, igual que
  el resto de este archivo ya documenta convenciones de "solo vía función X".

## RLS — `Guardian` y `ChildGuardian`

```jsonc
"create": {
  "$or": [
    { "user_condition": { "role": "admin" } },
    { "$and": [
        { "data.parish_id": "{{user.data.parish_id}}" },
        { "user_condition": { "data.parish_plan": "premium" } },
        { "user_condition": { "data.parish_license_status": "active" } }
    ]}
  ]
},
"update": { /* idéntico a create */ },
"read": {
  "$or": [
    { "user_condition": { "role": "admin" } },
    { "$and": [
        { "data.parish_id": "{{user.data.parish_id}}" },
        { "$or": [
            { "user_condition": { "data.parish_plan": "free" } },
            { "user_condition": { "data.parish_license_status": "active" } },
            { "user_condition": { "data.parish_license_status": "read_only" } }
        ]}
    ]}
  ]
},
"delete": { /* como hoy: solo parish_id + (admin de plataforma o de parroquia), sin condición de licencia */ }
```

`read` permite plan `free` incondicionalmente (paridad con el downgrade
voluntario ya existente: los datos que ya cargaste siguen visibles siempre en
gratis) y para plan `premium` exige `active` o `read_only` (bloquea solo en
`access_denied`/`deletion_eligible`). `create`/`update` exigen `premium` +
`active` estrictamente — cierra el hueco de seguridad real (hoy sin ningún
check) y hace cumplir en el backend lo que la UI ya prometía.

## Funciones nuevas

### `export_premium_data` (service-role, solo lectura)

- Verifica `me.parish_id` y que sea admin de parroquia (`parish_role === 'admin'`
  o `role === 'admin'`).
- Lee `Parish` fresca; requiere `plan === 'premium'` — no exige un
  `license_status` específico (funciona igual en `read_only`/`access_denied`,
  para que el admin pueda descargar sus datos apenas empiece a perder acceso,
  no solo cuando ya está totalmente bloqueado).
- `sr.entities.Guardian.filter({ parish_id })` +
  `sr.entities.ChildGuardian.filter({ parish_id })`.
- Devuelve `{ exported_at, parish: {id, name}, guardians: [...], child_guardians: [...] }`
  — JSON crudo; el frontend arma el `Blob` y dispara la descarga
  (`application/json`, nombre de archivo `tutores-{parroquia}-{fecha}.json`).
- **No** estampa `export_confirmed_at` — eso es un paso aparte y explícito
  (checkbox tras confirmar que ya guardaron el archivo), para que el registro
  de "confirmado" signifique una acción humana deliberada, no solo que el
  botón de descarga se haya clickeado.

### `confirm_premium_export` (service-role, escritura)

- Mismos checks de autorización que arriba.
- Requiere `license_status === 'access_denied'` (o `deletion_eligible`) — si
  no, `400 { error: 'no_aplica_en_este_estado' }`. (No se puede "confirmar
  exportación" mientras todavía tienes acceso normal — evita estados
  contradictorios.)
- `sr.entities.Parish.update(parish_id, { export_confirmed_at: now, export_confirmed_by: me.email })`.
- Retorna la parroquia actualizada.

## `create_parish` — gate de aceptación del aviso de privacidad

```ts
const accepted = body.data_processing_accepted === true;
if (!accepted) {
  return Response.json({ error: 'Debes aceptar el aviso de manejo de datos sensibles' }, { status: 400 });
}
// ...
const parish = await sr.entities.Parish.create({
  name, admin_contact, active: true,
  data_processing_accepted_at: new Date().toISOString(),
  data_processing_accepted_by: me.email,
  data_processing_terms_version: DATA_PROCESSING_TERMS_VERSION, // constante, p.ej. "2026-07-23"
});
await sr.entities.User.update(me.id, {
  parish_id: parish.id, parish_role: 'admin',
  parish_plan: 'free', parish_license_status: 'active',
});
```

`DATA_PROCESSING_TERMS_VERSION` vive como constante compartida
(`src/lib/legal.js`, importada tanto por el frontend para mostrar el texto
como — vía duplicación literal, Base44 functions no comparten módulos con
`src/` — por la función; se deja un comentario cruzado en ambos lados para no
desincronizar la versión).

## Puente `acaciaControl` — nueva acción `license.deletePremiumData`

Agregada a `base44/functions/acaciaControl/entry.ts` (reemplaza el comentario
placeholder obsoleto `// Fase 6 — writes land here...`). Genérica a propósito
— Mission Control decide qué se borra, el puente solo ejecuta:

```ts
case 'license.deletePremiumData': {
  const { deleteEntities } = params;
  if (!Array.isArray(deleteEntities) || deleteEntities.length === 0) {
    return Response.json({ error: 'params.deleteEntities required' }, { status: 400 });
  }
  const deletedCounts: Record<string, number> = {};
  for (const spec of deleteEntities) {
    // MC pasa deleteEntities en orden hijo→padre (ChildGuardian antes que
    // Guardian) para no dejar referencias huérfanas.
    const rows = await sr.entities[spec.entity].filter({ [spec.field]: spec.value });
    let count = 0;
    for (const row of rows) {
      try { await sr.entities[spec.entity].delete(row.id); count++; } catch { /* ya borrado o inaccesible, seguir */ }
    }
    deletedCounts[spec.entity] = count;
  }
  return Response.json({ ok: true, deletedCounts });
}
```

Deliberadamente **no** toca `Parish` — solo borra filas de las entidades que
Mission Control indique. El reset de `Parish` (`plan: 'free'`,
`license_status: 'active'`, limpiar los timestamps de ciclo de vida) va en
una llamada **separada** a la acción `license.set` ya existente (con
`mirror` para propagar a `User`, ver spec hermano §2) — así el borrado
destructivo y la escritura de estado quedan como dos pasos auditables
independientes, y un reintento tras un fallo parcial es seguro: `filter` +
`delete` sobre filas que ya no existen simplemente no encuentra nada que
borrar.

Mission Control llama esta acción con:
```js
{
  action: 'license.deletePremiumData',
  params: { deleteEntities: [
    { entity: 'ChildGuardian', field: 'parish_id', value: parishId },
    { entity: 'Guardian',      field: 'parish_id', value: parishId },
  ] },
}
```

## Frontend

### Pantalla de aceptación (`Parishes.jsx`, solo en modo "crear")

Checkbox obligatorio + texto colapsable (ver contenido completo abajo) antes
de habilitar "Crear y asignar". Usa `components/ui/checkbox.jsx` +
`dialog.jsx` para el texto completo en un modal ("Leer aviso completo").

### `src/lib/premium.js` → renombrar/extender a `useLicenseStatus(parish)`

```js
export function getLicenseStatus(parish) {
  const isPremium = parish?.plan === "premium";
  const status = isPremium ? (parish?.license_status || "active") : "active";
  return {
    tier: isPremium ? "premium" : "free",
    isPremium,
    status,               // 'active' | 'read_only' | 'access_denied' | 'deletion_eligible'
    isReadOnly: isPremium && (status === "read_only" || status === "access_denied" || status === "deletion_eligible"),
    isAccessDenied: isPremium && (status === "access_denied" || status === "deletion_eligible"),
    exportConfirmed: !!parish?.export_confirmed_at,
  };
}
```
(`getPremiumStatus`/`usePremiumStatus` se mantienen como alias para no romper
imports existentes en `Premium.jsx`/`ChildDetail.jsx` hasta migrarlos.)

### Banner (`Layout.jsx`)

Franja delgada arriba del `<Outlet>`, solo si `isPremium && status !== 'active'`:
- `read_only`: ámbar — "Tu plan Premium está pendiente de pago. Agregar o
  editar Tutores está pausado." + link a `/premium`.
- `access_denied`/`deletion_eligible`: rojo — "Acceso a Tutores denegado por
  falta de pago. Exporta tus datos antes de que se eliminen." + link a
  `/premium`.
- Nunca aparece para `plan === 'free'`, y nunca menciona niños/asistencia/grupos.

### `ChildDetail.jsx` — sección Tutores

Si `isAccessDenied`, la sección de Tutores no intenta leer `Guardian`
(evita el 403 de RLS) y en su lugar muestra: "El acceso a Tutores está
bloqueado por falta de pago del plan Premium." + link a `/premium`.

### `Premium.jsx` — nuevos estados

- `read_only`: card ámbar explicando la pausa + botón "Ver estado de pago"
  (mailto/link a soporte, no hay cobro automático hoy).
- `access_denied`/`deletion_eligible`: reemplaza el marketing de Premium por
  la **pantalla de exportación**:
  1. Botón "Descargar mis datos (Tutores)" → llama `export_premium_data`,
     arma el `Blob`, dispara la descarga.
  2. Tras descargar, checkbox habilitado "Descargué y guardé mis datos" →
     al marcarlo, llama `confirm_premium_export`.
  3. Si `export_confirmed_at` ya existe: mensaje de confirmación con la fecha,
     sin checkbox (ya no se puede desmarcar — es un registro, no un toggle).

## "Acerca de" — sección de certificaciones

Contenido nuevo en `About.jsx`, card aparte, con esta redacción (atribuida
explícitamente a Base44, con link para verificar — no se afirma que
CateqHub esté certificada por separado, y se omite ISO 27001 por no haber
podido confirmarlo de forma independiente):

> **Seguridad de la infraestructura**
> CateqHub corre sobre Base44, que declara cumplimiento **SOC 2 Tipo II** y
> ofrece un **Acuerdo de Procesamiento de Datos (DPA)** para el manejo de
> datos personales. Puedes verificar el estado vigente de estas
> certificaciones directamente en el [Centro de Confianza de Base44](https://base44.com/security).

## Aviso de manejo de datos sensibles (LFPDPPP) — contenido completo

Texto para la pantalla de aceptación (versión `2026-07-23`), en español,
dirigido al **admin de la parroquia** como responsable de los datos que
carga:

> **Aviso sobre el manejo de datos personales sensibles**
>
> CateqHub te permite registrar datos de niñas, niños y adolescentes inscritos
> en catecismo, incluyendo su **CURP**, nombre completo y fecha de nacimiento,
> así como datos de sus tutores. Conforme a la **Ley Federal de Protección de
> Datos Personales en Posesión de los Particulares (LFPDPPP)** y su
> Reglamento, los datos de menores de edad y la CURP se consideran
> información sensible y requieren un manejo cuidadoso.
>
> **Quién es responsable de estos datos.** Tu parroquia es la **responsable**
> (quien decide qué datos se recaban y para qué) de la información que cargas
> en CateqHub. CateqHub, operado sobre la infraestructura de Base44, actúa
> como **encargado** (quien trata los datos por cuenta de la parroquia,
> siguiendo sus instrucciones).
>
> **Tu obligación como responsable.** Antes de registrar los datos de un niño
> o niña en la plataforma, tu parroquia debe haber obtenido el consentimiento
> de su padre, madre o tutor (por ejemplo, en la hoja de inscripción física al
> catecismo) — este consentimiento en pantalla lo aceptas tú como
> administrador de la parroquia, y **no sustituye** el consentimiento que
> debes recabar de cada familia.
>
> **Para qué se usan estos datos.** Únicamente para llevar el control de
> asistencia, grupos y catecismo dentro de tu parroquia. CateqHub no vende ni
> comparte estos datos con terceros para fines distintos.
>
> **Derechos ARCO.** Las familias pueden solicitar a tu parroquia acceder,
> rectificar o cancelar los datos de sus hijos, u oponerse a su tratamiento,
> en cualquier momento — como responsable, tu parroquia debe poder atender
> esas solicitudes (editar/eliminar los registros correspondientes desde
> CateqHub).
>
> **Retención y eliminación.** Los datos del núcleo gratuito (niños, grupos,
> asistencia) permanecen mientras tu parroquia use la plataforma. Los datos de
> Tutores (función Premium) siguen las reglas del ciclo de vida de la
> licencia: si el pago de Premium no se confirma, primero se restringe la
> edición, después el acceso completo, y solo se eliminan tras haber tenido
> oportunidad de exportarlos — nunca de forma automática sin ese paso.
>
> **Al hacer clic en "Acepto" confirmas que:**
> - Tu parroquia es responsable del manejo de estos datos conforme a la LFPDPPP.
> - Cuentas con el consentimiento de los padres/tutores para registrar los
>   datos de cada niño o niña.
> - Entiendes el ciclo de solo lectura → acceso denegado → exportación →
>   eliminación aplicable a la función Premium.

## Flujo de datos (lado app)

```
Admin crea parroquia (Parishes.jsx)
  → checkbox aceptado → create_parish { ..., data_processing_accepted: true }
    → Parish.create({ ...consentimiento estampado })
    → User.update(me, { parish_id, parish_role:'admin', parish_plan:'free', parish_license_status:'active' })

Mission Control transiciona el estado (cron o botón operador, ver spec hermano)
  → acaciaControl license.set { entity:'Parish', id, patch:{license_status:'access_denied', access_denied_since}, mirror:[...] }
    → Parish actualizada + todos los User de esa parroquia reciben parish_license_status espejado

Admin entra a /premium en access_denied
  → export_premium_data → descarga JSON
  → checkbox "ya guardé mis datos" → confirm_premium_export → Parish.export_confirmed_at

(Mission Control, tras confirmar borrado — ver spec hermano)
  → acaciaControl license.deletePremiumData { deleteEntities:[ChildGuardian, Guardian] } → deletedCounts
  → acaciaControl license.set { patch:{plan:'free', license_status:'active', ...reset}, mirror:[...] }
```

## Manejo de errores

- `export_premium_data`/`confirm_premium_export`: 401 sin sesión, 403 si no es
  admin de parroquia, 400 si el estado no aplica. Nunca 500 silencioso —
  errores de Base44 se propagan con mensaje claro (igual que el resto de
  funciones del repo).
- RLS: al ser denegaciones, el cliente Base44 lanza error normal — los
  componentes ya envuelven sus fetch en `.catch()` (patrón existente en todo
  el repo) y muestran estado vacío/mensaje en vez de romper la página.
- Espejo `User` desincronizado (edición manual desde panel de Base44): el
  peor caso es que la RLS de Guardian quede un poco desfasada hasta el
  próximo `license.set` real; no es un fallo de seguridad grave (el campo
  fuente de verdad sigue siendo `Parish.license_status`, que Premium.jsx/el
  banner leen directo, sin depender del espejo — el espejo **solo** afecta la
  ventana de creación/edición de Tutores, nunca la visibilidad del estado en
  la UI).

## Pruebas

- Este repo **no tiene** `npm run validate:rls` (a diferencia de StockFlow) —
  no se agrega en este PR (fuera de alcance, ver abajo). La verificación de
  las reglas nuevas de `Guardian`/`ChildGuardian`/`Parish`/`User` es manual,
  documentada en el PR (ver "Manual" abajo).
- `npm run build` y `npm run lint` en verde.
- Manual (e2e con Playwright si el harness lo permite, o pasos documentados
  en el PR): crear parroquia sin aceptar (bloqueado) → aceptar (ok) → simular
  `license_status` en cada estado vía Base44 panel → verificar
  create/update/read de Guardian en cada uno → exportar → confirmar →
  verificar que el banner/pantalla cambian según lo esperado.

## Fuera de alcance (YAGNI)

- Cobro automático de Premium (Mercado Pago) — se activa manualmente hoy.
- Notificar a los padres/tutores directamente desde la app — la parroquia es
  la responsable frente a las familias, no CateqHub.
- Exportar en CSV/XLSX (además de JSON) — un archivo JSON es suficiente para
  "posibilidad de exportar sus datos"; se puede agregar después sin romper el
  diseño.
- Auto-desplegar este `.jsonc` al backend vivo de Base44 desde este PR — el
  conector MCP de Base44 no está autorizado en esta sesión; el despliegue
  (`update_entity_schema` / Base44 CLI) queda pendiente para quien tenga
  acceso, documentado explícitamente en el PR.
- Agregar un script `validate:rls` a este repo (como el de StockFlow) — sería
  valioso pero es una herramienta aparte, no parte de este alcance.
