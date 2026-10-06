// Layout scan: overlapping interactive elements, horizontal overflow, clipped
// text and controls covered by something else, per screen and viewport.
//
// Usage: node scripts/layout-overlap-scan.mjs [--dist dir] [--json out.json] [--shots dir]
//   --dist serves an existing production build (vite build --outDir dir) instead of the dev server.
// Starts Vite itself and fulfils EVERY /api/ request locally (nothing reaches
// Base44). Needs a Playwright Chromium. Exits 1 when anything is reported.
import { createServer, preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const JSON_OUT = argOf('--json');
const SHOTS = argOf('--shots');

const VIEWPORTS = [
  [320, 640], [390, 844], [768, 1024], [834, 1194], [1024, 1366], [1024, 768], [1440, 900],
];
const C = '2026-09-01T12:00:00.000000';
const P = 'p1';
const USER = { id: 'u1', email: 'admin@example.invalid', full_name: 'Administrador Prueba', role: 'user', parish_id: P, parish_role: 'admin' };
const today = new Date().toISOString().slice(0, 10);

function fixtures() {
  return {
    Parish: [{ id: P, name: 'Parroquia de Nuestra Señora de los Dolores del Valle', admin_contact: 'admin@example.invalid', join_code: 'ABCD-EFGH', license_status: 'active', plan: 'premium', premium_period_end_at: '2026-10-30', data_processing_accepted_at: C, created_date: C }],
    Group: ['Primera Comunión A', 'Primera Comunión B', 'Confirmación juvenil', 'Pre-catequesis'].map((n, i) => ({ id: `g${i}`, parish_id: P, name: n, level: `Nivel ${i + 1}`, catechist_id: 'u2', created_date: C })),
    Child: ['Ana Sofía Hernández Ramírez', 'Bruno', 'Carla Fernanda López de la Torre', 'Diego', 'Elena', 'Fernando Alberto', 'Gabriela', 'Hugo'].map((n, i) => ({ id: `c${i}`, parish_id: P, group_id: `g${i % 4}`, name: n, birth_date: '2016-03-01', curp: 'HERA160301MASRMNA1', qr_token: `tok${i}`, active: true, created_date: C })),
    Attendance: [0, 1, 2, 3].map((i) => ({ id: `a${i}`, parish_id: P, group_id: `g${i}`, child_id: `c${i}`, date: today, recorded_by: 'u1', created_date: C })),
    PermissionProfile: [], SupportTicket: [
      { id: 't1', parish_id: P, subject: 'No puedo imprimir los gafetes de mi grupo', status: 'abierto', category: 'soporte', body: 'Texto largo '.repeat(10), created_date: C, created_by: 'admin@example.invalid' },
    ], SupportTicketMessage: [], Guardian: [], ChildGuardian: [],
  };
}
function matches(row, f) {
  if (!f) return true;
  return Object.entries(f).every(([k, v]) => {
    if (k === '$and') return v.every((x) => matches(row, x));
    if (k === '$or') return v.some((x) => matches(row, x));
    if (v && typeof v === 'object') { if ('$in' in v) return v.$in.map(String).includes(String(row[k])); return true; }
    if (row[k] === undefined) return true;
    return String(row[k]) === String(v);
  });
}
async function mock(ctx) {
  const db = fixtures();
  // Nothing external (fonts, analytics) may stall the load event.
  await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
  await ctx.route((u) => u.pathname.startsWith('/api/') || /socket\.io/.test(u.href), async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* */ }
    const json = (x, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(x) });
    if (/socket\.io/.test(url.href)) return route.abort();
    if (p.includes('public-settings')) return json({ id: 'mockapp', public_settings: {} });
    if (p.endsWith('/entities/User/me')) return json(USER);
    let m = p.match(/\/entities\/(\w+)(?:\/(\w+))?$/);
    if (m) {
      const rows = db[m[1]] || [];
      if (req.method() !== 'GET') return json({ id: `mock_${Date.now()}`, ...body });
      if (m[2]) return json(rows.find((r) => r.id === m[2]) || {});
      let q = {}; try { q = JSON.parse(url.searchParams.get('q') || '{}'); } catch { /* */ }
      return json(rows.filter((r) => matches(r, q)));
    }
    m = p.match(/\/functions\/(\w+)/);
    if (m) {
      const fn = m[1];
      if (fn === 'list_parish_users') return json({ users: [
        { id: 'u1', email: 'admin@example.invalid', full_name: 'Administrador Prueba', parish_role: 'admin' },
        { id: 'u2', email: 'catequista.con.un.correo.muy.largo@example.invalid', full_name: 'Catequista de Nombre Muy Largo Prueba', parish_role: 'catequist', group_id: 'g0' },
      ] });
      if (fn === 'assign_parish_user') {
        if (body.action === 'join_code') return json({ join_code: 'ABCD-EFGH' });
        if (body.action === 'list_join_requests') return json({ requests: [{ id: 'r1', user_email: 'solicitante.largo@example.invalid', user_name: 'Solicitante Prueba', created_date: C }] });
        return json({ ok: true });
      }
      if (fn === 'session') return json({ ok: true, session_id: 's1', status: 'active' });
      return json({ ok: true });
    }
    return json({ ok: true });
  });
}

const SCREENS = ['/', '/escanear', '/grupos', '/ninos', '/ninos/c0', '/ninos/gafetes', '/reportes', '/usuarios', '/parroquia', '/permisos', '/premium', '/soporte', '/manual', '/acerca-de'];
const PUBLIC = ['/login', '/register', '/forgot-password', '/reset-password'];

async function analyze(page, pos) {
  return page.evaluate((pos) => {
    const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=combobox], [role=checkbox], [role=switch], [role=menuitem]';
    const name = (el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.name || '').replace(/\s+/g, ' ').trim().slice(0, 36)}"`;
    const vis = (el) => {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
      if (el.closest('[aria-hidden="true"], [inert], .sr-only, .print\\:block, [hidden]')) return false;
      return true;
    };
    const els = [...document.querySelectorAll(SEL)].filter(vis).filter((e) => !(e.type === 'checkbox' && e.closest('label')));
    const out = { overlaps: [], overflow: [], clipped: [], covered: [] };
    const rect = (e) => e.getBoundingClientRect();
    // A fixed/sticky bar over scrolling content is normal while it scrolls under it; it is a
    // defect only where the content can no longer be scrolled clear of it: top bars at scroll 0,
    // bottom bars at the bottom of the page. Fixed-vs-fixed pairs always count.
    const barOf = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') { const r = n.getBoundingClientRect(); return { top: r.top + r.height / 2 < innerHeight / 2 }; } } return null; };
    const relevant = (a, b) => {
      const ba = barOf(a), bb = barOf(b);
      if (ba && bb) return true;
      const bar = ba || bb; if (!bar) return true;
      return bar.top ? pos === 0 : pos === 1;
    };
    // Overlap: two interactive elements whose boxes intersect by more than 2px each way.
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (!relevant(a, b)) continue;
      // Per line box: a link that wraps has a bounding box spanning both lines.
      let w = 0, h = 0;
      for (const ra of a.getClientRects()) for (const rb of b.getClientRects()) {
        const ww = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const hh = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ww > 2 && hh > 2 && ww * hh > w * h) { w = ww; h = hh; }
      }
      if (w > 2 && h > 2) {
        // Same label pair (input inside/associated with a label) is not an overlap.
        if (a.closest('label') && a.closest('label') === b.closest('label')) continue;
        out.overlaps.push(`${name(a)} x ${name(b)} (${Math.round(w)}x${Math.round(h)}px)`);
      }
    }
    // Covered: the element's centre hit-tests to something that is not it.
    for (const e of els) {
      const r = rect(e);
      if (r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) continue;
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
      const at = document.elementFromPoint(x, y);
      if (at && at !== e && relevant(e, at) && !e.contains(at) && !at.contains(e) && !(e.closest('label') && e.closest('label').contains(at))) {
        out.covered.push(`${name(e)} covered by ${name(at)}`);
      }
    }
    // Horizontal overflow of the page.
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 1) out.overflow.push(`page ${de.scrollWidth} > ${innerWidth}`);
    for (const e of document.querySelectorAll('body *')) {
      const r = rect(e); if (r.width < 2) continue;
      if (r.right > innerWidth + 1 && vis(e) && !e.closest('[data-radix-popper-content-wrapper], [role=tooltip]') && getComputedStyle(e).position !== 'fixed') {
        const sc = e.closest('[class*="overflow-x"], table, pre');
        if (!sc) { out.overflow.push(`${name(e)} right=${Math.round(r.right)}`); break; }
      }
    }
    // Clipped text in controls/labels: content wider/taller than the box while overflow hidden.
    for (const e of document.querySelectorAll('button, a, label, th, td, h1, h2, h3, [class*="badge"], [class*="truncate"]')) {
      if (!vis(e)) continue;
      const cs = getComputedStyle(e);
      const clipsX = ['hidden', 'clip'].includes(cs.overflowX), clipsY = ['hidden', 'clip'].includes(cs.overflowY);
      if (!clipsX && !clipsY && ['A', 'BUTTON', 'LABEL'].includes(e.tagName) && cs.display !== 'inline' && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1) out.clipped.push(`${name(e)} spills ${e.scrollWidth}>${e.clientWidth}`);
      if (clipsX && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis') out.clipped.push(`${name(e)} ${e.scrollWidth}>${e.clientWidth}`);
      else if (clipsY && e.scrollHeight > e.clientHeight + 1) out.clipped.push(`${name(e)} h ${e.scrollHeight}>${e.clientHeight}`);
    }
    return out;
  }, pos);
}

async function main() {
  process.env.VITE_BASE44_APP_ID ||= 'mockapp';
  process.env.VITE_BASE44_APP_BASE_URL ||= 'http://localhost:6173';
  // --dist <dir>: serve an existing production build (much lighter than the dev server).
  const DIST = argOf('--dist');
  const server = DIST
    ? await preview({ build: { outDir: DIST }, preview: { port: 6173, strictPort: true }, logLevel: 'error' })
    : await createServer({ server: { port: 6173, strictPort: true }, logLevel: 'error' });
  if (!DIST) await server.listen();
  const base = DIST ? 'http://localhost:6173' : server.resolvedUrls.local[0].replace(/\/$/, '');
  const launch = () => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  let browser = await launch();
  if (SHOTS) await mkdir(SHOTS, { recursive: true });
  const report = []; let bad = 0;
  try {
    for (const theme of ['light', 'dark']) for (const [w, h] of VIEWPORTS) {
      const touch = w < 1440;
      for (const authed of [false, true]) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (!browser.isConnected()) browser = await launch();
            const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: touch, locale: 'es-MX' });
            await ctx.addInitScript((t) => { localStorage.setItem('cq-theme', t); }, theme);
            if (authed) await ctx.addInitScript(() => localStorage.setItem('base44_access_token', 'mock'));
            await mock(ctx);
            const page = await ctx.newPage();
            const local = []; let n0 = 0;
            for (const path of authed ? SCREENS : PUBLIC) {
              await page.goto(base + path); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(400);
              for (const pos of [0, 1]) {
                if (pos) { for (let k = 0; k < 2; k++) { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400); } }
                const r = await analyze(page, pos);
                const n = r.overlaps.length + r.overflow.length + r.clipped.length + r.covered.length;
                const tag = `${theme} ${w}x${h} ${path}${pos ? ' (bottom)' : ''}`;
                local.push({ tag, ...r });
                if (n) { n0++; console.log(`FAIL ${tag}\n  ${[...r.overlaps.map((x) => 'overlap: ' + x), ...r.overflow.map((x) => 'overflow: ' + x), ...r.clipped.map((x) => 'clipped: ' + x), ...r.covered.map((x) => 'covered: ' + x)].slice(0, 8).join('\n  ')}`); if (SHOTS) await page.screenshot({ path: `${SHOTS}/${theme}-${w}x${h}-${path.replace(/\W+/g, '_')}${pos ? '-b' : ''}.png` }); }
              }
            }
            await ctx.close();
            report.push(...local); bad += n0;
            break;
          } catch (e) {
            console.log(`retry (${e.message.split('\n')[0]})`);
            try { await browser.close(); } catch { /* gone */ }
            browser = await launch();
          }
        }
      }
    }
  } finally { await browser.close(); await (server.close ? server.close() : server.httpServer.close()); }
  if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(report, null, 2));
  console.log(bad ? `\n${bad} states with layout problems` : '\n0 layout problems');
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
