import { test, expect } from '@playwright/test';

test.describe('Pruebas E2E del Sistema TuCancha', () => {

  test('Debería cargar la página de inicio y verificar la sección de beneficios', async ({ page }) => {
    // 1. Ir a la Landing Page
    await page.goto('/');

    // 2. Verificar el título principal
    await expect(page.locator('h1')).toContainText('Reserva canchas deportivas');

    // 3. Verificar que las tarjetas de beneficios principales estén visibles
    await expect(page.getByRole('heading', { name: 'Sistema de Reservas', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Múltiples Sedes', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pagos Seguros', exact: true })).toBeVisible();
  });

  test('Debería validar la sección de comentarios de clientes', async ({ page }) => {
    await page.goto('/');

    // 1. Verificar el título de la sección de opiniones
    await expect(page.getByRole('heading', { name: 'Lo que dicen nuestros clientes' })).toBeVisible();

    // 2. Comprobar que al menos un comentario/testimonio de cliente sea visible en pantalla
    await expect(page.getByText('Carlos Rodríguez')).toBeVisible();
  });

  test('Debería permitir navegar al formulario de inicio de sesión', async ({ page }) => {
    // 1. Navegar directamente a la ruta de inicio de sesión
    await page.goto('/login');

    // 2. Validar que la URL haya cambiado al login
    await expect(page).toHaveURL(/\/login/);

    // 3. Comprobar que el formulario contiene los inputs de credenciales
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

});
