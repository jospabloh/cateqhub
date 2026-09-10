/**
 * Shared validation for Base44 entity RLS rules. Used by the Node CLI
 * (scripts/validate-entity-rls.mjs); adapted from the equivalent guard in
 * jospabloh/stockflow, written after that app's "cero items" outage
 * (2026-06-16) — every entity↔user RLS comparison has two halves, and
 * getting either wrong fails silently:
 *
 *   - ENTITY side: custom fields live under `data.` in Base44. A rule key must
 *     be a built-in (id, created_by_id, created_date, updated_date) or start
 *     with `data.`. A bare `parish_id` references a non-existent field → the
 *     rule never matches → RLS effectively OFF (cross-tenant leak).
 *
 *   - USER side: custom user fields resolve as `{{user.data.<field>}}`. The
 *     only bare built-ins are `{{user.id}}`, `{{user.email}}`, `{{user.role}}`.
 *     `{{user.parish_id}}` resolves to nothing → the rule matches nothing →
 *     ZERO rows for everyone.
 *
 * CateqHub's own rules (base44/entities/*.jsonc) currently pass this check —
 * it exists so a future edit can't silently regress them the way StockFlow's
 * did, since this repo had no guard at all before this script (only manual
 * review per CHANGELOG.md's audit entries).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BUILTIN_ENTITY_FIELDS = new Set([
  "id",
  "created_by_id",
  "created_by",
  "created_date",
  "updated_date",
]);
const BUILTIN_USER_VARS = new Set(["id", "email", "role"]);
const LOGICAL_OPERATORS = new Set(["$or", "$and", "$nor", "$not"]);

/** Strip // and block comments so JSONC parses as JSON. */
export function parseJsonc(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
  return JSON.parse(noLine);
}

function checkUserTemplates(value, entity, opLabel, errors) {
  const json = JSON.stringify(value);
  const re = /\{\{\s*user\.([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(json)) !== null) {
    const path = m[1];
    if (path.startsWith("data.")) continue;
    if (BUILTIN_USER_VARS.has(path)) continue;
    errors.push(
      `${entity} [${opLabel}]: user template "{{user.${path}}}" is invalid. ` +
        `Custom user fields must be "{{user.data.${path}}}" ` +
        `(only id/email/role are bare built-ins).`,
    );
  }
}

/**
 * Cross-tenant role-branch check — added 2026-08-18 after a live bug found in
 * Parish.jsonc: its `delete` (and `update`) rule had a bare
 * {"user_condition": {"data.parish_role": "admin"}} branch with NO
 * accompanying entity-side tenant match. That branch is syntactically valid
 * (Base44 only requires user_condition to be the sole key of ITS OWN rule
 * object — this check is about "sole key" being logically enough, not about
 * syntax) but grants the capability to ANY user with that custom role IN ANY
 * TENANT, not just their own — the entity-scoping half of the rule was
 * simply missing. Base44's own deploy-time validator does not catch this: a
 * lone {"user_condition": {"data.x": "y"}} branch is perfectly valid syntax,
 * the problem is purely that it's too permissive, which only a semantic
 * check (like this one) can catch.
 *
 * The built-in {{user.role}}/"role" field is exempt — role:"admin" is the
 * platform-owner/service-role tier and is intentionally cross-tenant by
 * design (see every entity's admin branch). Only CUSTOM (data.-prefixed)
 * role-like fields are the risk, since those represent a role scoped to one
 * tenant (e.g. data.parish_role, data.app_role, data.business_role) and a
 * bare check of one, unpaired with an entity-side tenant match, lets that
 * role apply across every tenant instead of just the caller's own.
 */
/** True for a plain condition object like {"data.parish_id": "..."} or
 * {"id": "..."} — a key that isn't "user_condition" and isn't a logical
 * operator scopes the rule to a specific entity field. */
function objectHasEntityScopeKey(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return false;
  return Object.keys(obj).some((k) => k !== "user_condition" && !LOGICAL_OPERATORS.has(k));
}

/**
 * `protectedByEntityMatch` is true once an ancestor $and in the current
 * branch chain already contains an entity-scoping sibling (e.g.
 * data.parish_id) — that protection carries through any $or nested inside
 * that $and, since every leaf of the $or is still AND-ed against the tenant
 * match. It resets to false whenever we cross into a *new*, unprotected $or
 * (i.e. one not itself sitting inside a protecting $and).
 */
function checkCrossTenantRoleBranches(rule, entity, opLabel, errors, protectedByEntityMatch = false) {
  if (rule === null || typeof rule !== "object") return;
  if (Array.isArray(rule)) {
    for (const branch of rule) checkCrossTenantRoleBranches(branch, entity, opLabel, errors, protectedByEntityMatch);
    return;
  }
  const keys = Object.keys(rule);
  if (keys.includes("user_condition") && keys.length > 1) {
    errors.push(
      `${entity} [${opLabel}]: {"user_condition": ..., ${keys.filter((k) => k !== "user_condition").map((k) => `"${k}"`).join(", ")}: ...} ` +
        `mixes user_condition with sibling keys in one object — Base44's deploy-time ` +
        `validator REJECTS this (user_condition must be the only key of its own rule ` +
        `object). Combine them explicitly: {"$and": [{"${keys.find((k) => k !== "user_condition")}": ...}, {"user_condition": ...}]}.`,
    );
    return;
  }
  if ("$or" in rule) {
    checkCrossTenantRoleBranches(rule.$or, entity, opLabel, errors, protectedByEntityMatch);
    return;
  }
  if ("$and" in rule) {
    const branches = rule.$and;
    const hasEntityMatch = protectedByEntityMatch || (Array.isArray(branches) && branches.some(objectHasEntityScopeKey));
    for (const branch of branches) checkCrossTenantRoleBranches(branch, entity, opLabel, errors, hasEntityMatch);
    return;
  }
  if (keys.length === 1 && keys[0] === "user_condition" && !protectedByEntityMatch) {
    const condKeys = Object.keys(rule.user_condition || {});
    for (const ck of condKeys) {
      if (ck !== "role" && ck.startsWith("data.")) {
        errors.push(
          `${entity} [${opLabel}]: branch {"user_condition":{"${ck}":...}} has no ` +
            `accompanying entity-side tenant match (e.g. an "id"/"data.<tenant_id>" ` +
            `condition combined via $and) — this custom role check applies across ` +
            `EVERY tenant, not just the caller's own. Wrap it: ` +
            `{"$and":[{"id":"{{user.data.<tenant_id_field>}}"},` +
            `{"user_condition":{"${ck}":...}}]}.`,
        );
      }
    }
  }
}

function checkEntityKeys(rule, entity, opLabel, errors) {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) return;
  for (const key of Object.keys(rule)) {
    if (key === "user_condition") continue;
    if (LOGICAL_OPERATORS.has(key)) {
      const branches = Array.isArray(rule[key]) ? rule[key] : [rule[key]];
      branches.forEach((b) => checkEntityKeys(b, entity, opLabel, errors));
      continue;
    }
    if (key.startsWith("$")) continue;
    if (key.startsWith("data.")) continue;
    if (BUILTIN_ENTITY_FIELDS.has(key)) continue;
    errors.push(
      `${entity} [${opLabel}]: rule key "${key}" must use the "data." prefix ` +
        `(custom entity fields live under data.; bare "${key}" matches nothing ` +
        `→ RLS effectively disabled).`,
    );
  }
}

/**
 * Scan an entities directory and return { errors, total, tenantScoped }.
 * errors is an array of human-readable strings; empty means valid.
 */
export function collectRlsErrors(entitiesDir) {
  const errors = [];
  const files = readdirSync(entitiesDir).filter((f) => f.endsWith(".jsonc"));
  let tenantScoped = 0;

  for (const file of files) {
    const entity = file.replace(/\.jsonc$/, "");
    let schema;
    try {
      schema = parseJsonc(readFileSync(join(entitiesDir, file), "utf8"));
    } catch (e) {
      errors.push(`${entity}: failed to parse JSONC — ${e.message}`);
      continue;
    }
    const rls = schema.rls;
    if (!rls) continue;

    for (const op of ["create", "read", "update", "delete"]) {
      if (!(op in rls)) continue;
      checkUserTemplates(rls[op], entity, op, errors);
      checkEntityKeys(rls[op], entity, op, errors);
      checkCrossTenantRoleBranches(rls[op], entity, op, errors);
    }

    // Tenant-scoped entities (have parish_id) must filter read by
    // data.parish_id == {{user.data.parish_id}}. Platform-admin entities
    // that gate read behind role:admin are exempt — they are not per-tenant
    // readable.
    const hasParishId = schema.properties && "parish_id" in schema.properties;
    const adminGated = rls.read &&
      JSON.stringify(rls.read) === '{"user_condition":{"role":"admin"}}';

    // Entidades cuya lectura va, A PROPÓSITO, por usuario y no por parroquia.
    // Hoy la lista está VACÍA: la única que estuvo aquí fue `Membership`, del
    // módulo 18 (varias parroquias por cuenta), retirado el 2026-09-10.
    //
    // Una excepción aquí NO afloja el aislamiento, lo cambia de eje, y eso se
    // comprueba abajo: se EXIGE que la lectura vaya contra {{user.id}}. Sin
    // esa comprobación, esta lista sería una puerta para saltarse el check
    // entero poniendo una entidad nueva dentro.
    const USER_SCOPED_READ = [];
    if (hasParishId && rls.read && !adminGated && USER_SCOPED_READ.includes(entity)) {
      const readJson = JSON.stringify(rls.read);
      if (!readJson.includes('"data.user_id":"{{user.id}}"')) {
        errors.push(
          `${entity} [read]: está en USER_SCOPED_READ, así que su lectura debe ` +
            `ir por {"data.user_id":"{{user.id}}"} en vez de por parroquia. ` +
            `Sin eso no está acotada por nada.`,
        );
      }
      if (!readJson.includes('"user_condition":{"role":"admin"}')) {
        errors.push(
          `${entity} [read]: le falta la rama de rol de servicio, igual que a ` +
            `las tenant-scoped — asServiceRole.filter() devolvería cero filas.`,
        );
      }
      for (const op of ["create", "update", "delete"]) {
        if (!(op in rls) || !JSON.stringify(rls[op]).includes('"user_condition":{"role":"admin"}')) {
          errors.push(
            `${entity} [${op}]: debe existir e incluir ` +
              `{"user_condition":{"role":"admin"}} — se escribe sólo desde funciones de servicio.`,
          );
        }
      }
      tenantScoped++;
      continue;
    }

    if (hasParishId && rls.read && !adminGated) {
      tenantScoped++;
      const readJson = JSON.stringify(rls.read);
      const adminBranch = '"user_condition":{"role":"admin"}';
      if (!readJson.includes('"data.parish_id":"{{user.data.parish_id}}"')) {
        errors.push(
          `${entity} [read]: tenant-scoped entity (has parish_id) must ` +
            `filter read by {"data.parish_id":"{{user.data.parish_id}}"}.`,
        );
      }

      // READ side: the tenant equality above keeps end users isolated, but
      // the read rule must ALSO carry the service-role branch. Backend Safe
      // functions (update_child, add_guardian, record_attendance, ...) load a
      // record via base44.asServiceRole BEFORE acting on it, and
      // asServiceRole evaluates as role:admin with NO end-user context — so a
      // read rule of only {"data.parish_id":"{{user.data.parish_id}}"}
      // resolves the user template to empty and asServiceRole.filter()
      // returns ZERO rows. The function then sees "not found" and fails
      // silently. Same OR-branch as writes.
      if (!readJson.includes(adminBranch)) {
        errors.push(
          `${entity} [read]: tenant-scoped read rule must include the ` +
            `service-role branch {"user_condition":{"role":"admin"}} (e.g. ` +
            `{"$or":[{"data.parish_id":"{{user.data.parish_id}}"},` +
            `{"user_condition":{"role":"admin"}}]}). Backend reads go through ` +
            `base44.asServiceRole (role:admin, no end-user context); without ` +
            `this branch asServiceRole.filter() returns empty and Safe ` +
            `functions that read-then-write fail silently. End users stay ` +
            `isolated via the tenant equality — catequistas never match ` +
            `role:admin.`,
        );
      }

      // WRITE side: create/update/delete must allow the service role, for
      // the same reason — every write goes through base44.asServiceRole.
      // Exception: the built-in `User` entity has no create/delete rule by
      // design — account creation goes through Base44's own auth signup
      // flow, not a custom entity create call, and there is no self-serve
      // user-delete path in this app. Confirmed by comparing against
      // stockflow's own User.jsonc, which likewise defines no rls at all for
      // User. Enforcing create/delete here would be a false positive, not a
      // real gap.
      const requiredOps = entity === "User" ? ["update"] : ["create", "update", "delete"];
      for (const op of requiredOps) {
        if (!(op in rls)) {
          errors.push(
            `${entity} [${op}]: tenant-scoped entity must define a ${op} rule.`,
          );
          continue;
        }
        if (!JSON.stringify(rls[op]).includes(adminBranch)) {
          errors.push(
            `${entity} [${op}]: tenant-scoped write rule must include ` +
              `{"user_condition":{"role":"admin"}} (e.g. {"$or":[` +
              `{"data.parish_id":"{{user.data.parish_id}}"},` +
              `{"user_condition":{"role":"admin"}}]}). Backend writes go ` +
              `through base44.asServiceRole (role:admin, no end-user context); ` +
              `without this branch the user template resolves to empty and ` +
              `EVERY write via a Safe function fails silently.`,
          );
        }
      }
    }
  }

  return { errors, total: files.length, tenantScoped };
}
