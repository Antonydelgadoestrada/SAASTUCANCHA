/**
 * TuCancha - Sistema Ético de Gestión de Consentimiento de Cookies
 * Conforme a estándares internacionales de privacidad (GDPR, ePrivacy, LGPD y Ley de Protección de Datos Personales).
 */

export const COOKIE_CONSENT_KEY = "tucancha_cookie_consent_v1";
export const COOKIE_CONSENT_EVENT = "tucancha:cookie-consent-updated";
export const OPEN_COOKIE_MODAL_EVENT = "tucancha:open-cookie-preferences";
export const CURRENT_CONSENT_VERSION = "1.0.0";

export interface CookiePreferences {
  necessary: boolean;   // Siempre true (técnicas, autenticación de sesión, seguridad)
  functional: boolean;  // Recordar canchas preferidas, tema claro/oscuro, filtros
  analytics: boolean;   // Métricas anónimas de rendimiento para mejorar la app
  marketing: boolean;   // Promociones de clubes y novedades
}

export interface StoredCookieConsent extends CookiePreferences {
  timestamp: string;
  version: string;
}

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

/**
 * Obtiene el consentimiento almacenado o null si no se ha configurado aún.
 */
export function getStoredCookieConsent(): StoredCookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCookieConsent;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...DEFAULT_COOKIE_PREFERENCES,
      ...parsed,
      necessary: true, // Forzar que necesarias siempre sea true
    };
  } catch {
    return null;
  }
}

/**
 * Guarda las preferencias del usuario de forma transparente y emite evento reactivo.
 */
export function saveCookieConsent(prefs: Partial<CookiePreferences>): StoredCookieConsent {
  const consent: StoredCookieConsent = {
    necessary: true,
    functional: Boolean(prefs.functional),
    analytics: Boolean(prefs.analytics),
    marketing: Boolean(prefs.marketing),
    timestamp: new Date().toISOString(),
    version: CURRENT_CONSENT_VERSION,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }));
    } catch (e) {
      console.warn("No se pudo persistir el consentimiento de cookies:", e);
    }
  }

  return consent;
}

/**
 * Acepta todas las cookies.
 */
export function acceptAllCookies(): StoredCookieConsent {
  return saveCookieConsent({
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
  });
}

/**
 * Acepta únicamente las cookies necesarias/técnicas (rechaza funcionales, analíticas y marketing).
 */
export function acceptOnlyNecessaryCookies(): StoredCookieConsent {
  return saveCookieConsent({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
}

/**
 * Dispara el evento para reabrir el modal de preferencias desde cualquier parte (footer, settings, etc).
 */
export function triggerOpenCookiePreferences(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_COOKIE_MODAL_EVENT));
  }
}
