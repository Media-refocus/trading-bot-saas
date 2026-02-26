import { test, expect } from "@playwright/test";

test.describe("Autenticacion", () => {
  test("deberia mostrar la pagina de login", async ({ page }) => {
    await page.goto("/login");

    // Verificar titulo y descripcion
    await expect(page.getByRole("heading", { name: /iniciar sesion/i })).toBeVisible();
    await expect(page.getByText(/ingresa tus credenciales/i)).toBeVisible();

    // Verificar campos del formulario
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Verificar boton de submit
    await expect(page.getByRole("button", { name: /iniciar sesion/i })).toBeVisible();
  });

  test("deberia mostrar la pagina de registro", async ({ page }) => {
    await page.goto("/register");

    // Verificar titulo
    await expect(page.getByRole("heading", { name: /crear cuenta/i })).toBeVisible();

    // Verificar campos del formulario
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    // Verificar boton de submit
    await expect(page.getByRole("button", { name: /crear cuenta/i })).toBeVisible();
  });

  test("deberia redirigir a login si no autenticado en ruta protegida", async ({ page }) => {
    await page.goto("/dashboard");

    // Deberia redirigir a login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("deberia mostrar error con credenciales invalidas", async ({ page }) => {
    await page.goto("/login");

    // Llenar formulario con credenciales inexistentes
    await page.locator("#email").fill("nonexistent@example.com");
    await page.locator("#password").fill("wrongpassword123");
    await page.getByRole("button", { name: /iniciar sesion/i }).click();

    // Deberia mostrar mensaje de error
    await expect(page.locator(".bg-red-500\\/10")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/credenciales invalidas/i)).toBeVisible();
  });

  test("deberia registrar un usuario nuevo", async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.goto("/register");

    // Llenar formulario de registro
    await page.locator("#name").fill("Usuario Test");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");

    // Enviar formulario
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    // Deberia redirigir a dashboard despues del registro
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("deberia mostrar error si los passwords no coinciden en registro", async ({ page }) => {
    await page.goto("/register");

    // Llenar formulario con passwords diferentes
    await page.locator("#name").fill("Usuario Test");
    await page.locator("#email").fill("test-mismatch@example.com");
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password456");

    // Enviar formulario
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    // Deberia mostrar error de passwords no coinciden
    await expect(page.locator(".bg-red-500\\/10")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/passwords no coinciden/i)).toBeVisible();
  });

  test("deberia hacer login y logout correctamente", async ({ page }) => {
    // Primero crear un usuario via registro
    const uniqueEmail = `logout-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.locator("#name").fill("Usuario Logout");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: /crear cuenta/i }).click();

    // Esperar a que redirija a dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verificar que la navegacion esta visible (indicador de sesion activa)
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    // Hacer logout
    await page.getByRole("button", { name: /cerrar sesion/i }).click();

    // Deberia redirigir a login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Verificar que no puede acceder a dashboard sin autenticacion
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("deberia permitir login despues de registro", async ({ page }) => {
    const uniqueEmail = `login-test-${Date.now()}@example.com`;
    const password = "password123";

    // Registrar usuario
    await page.goto("/register");
    await page.locator("#name").fill("Usuario Login Test");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Hacer logout
    await page.getByRole("button", { name: /cerrar sesion/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Hacer login con las mismas credenciales
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /iniciar sesion/i }).click();

    // Deberia entrar al dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test("deberia redirigir usuario autenticado de login a dashboard", async ({ page }) => {
    // Crear usuario
    const uniqueEmail = `redirect-test-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.locator("#name").fill("Usuario Redirect");
    await page.locator("#email").fill(uniqueEmail);
    await page.locator("#password").fill("password123");
    await page.locator("#confirmPassword").fill("password123");
    await page.getByRole("button", { name: /crear cuenta/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Intentar ir a login estando autenticado
    await page.goto("/login");

    // Deberia redirigir a dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
