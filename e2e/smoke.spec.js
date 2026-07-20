// Smoke tests against the production build (via `vite preview`).
// These only exercise routes that don't require a live Base44 backend —
// there is no backend available in CI, so anything behind real auth/data
// is out of scope here. What we do verify: the public screens render with
// the right content in Spanish, and route protection actually redirects.
import { test, expect } from "@playwright/test";

test.describe("pantallas públicas", () => {
  test("login: encabezado, campos y botón esperados", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear una" })).toBeVisible();
  });

  test("registro: encabezado esperado", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
  });

  test("olvidé mi contraseña: encabezado esperado", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Restablecer contraseña" })).toBeVisible();
  });

  test("restablecer contraseña sin token: pantalla de enlace inválido", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Enlace inválido" })).toBeVisible();
  });

  test("restablecer contraseña con token: formulario de nueva contraseña", async ({ page }) => {
    await page.goto("/reset-password?token=fake-token-for-smoke-test");
    await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
  });

  test("ruta inexistente: 404 en español", async ({ page }) => {
    await page.goto("/esto-no-existe");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Página no encontrada")).toBeVisible();
  });
});

test.describe("protección de rutas", () => {
  test("una ruta protegida redirige a /login sin sesión", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/escanear redirige a /login sin sesión", async ({ page }) => {
    await page.goto("/escanear");
    await expect(page).toHaveURL(/\/login$/);
  });
});
