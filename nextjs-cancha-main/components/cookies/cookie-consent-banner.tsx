"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, Cookie, Settings, Check, X, Info, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  acceptAllCookies,
  acceptOnlyNecessaryCookies,
  getStoredCookieConsent,
  OPEN_COOKIE_MODAL_EVENT,
  saveCookieConsent,
  StoredCookieConsent,
} from "@/lib/cookie-consent"

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Estados de preferencias en el modal
  const [functional, setFunctional] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    setMounted(true)
    const existingConsent = getStoredCookieConsent()
    if (!existingConsent) {
      // Si no hay consentimiento previo, mostramos el banner tras un breve retardo para no saturar
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 700)
      return () => clearTimeout(timer)
    } else {
      // Sincronizar estado local de los switches
      setFunctional(existingConsent.functional)
      setAnalytics(existingConsent.analytics)
      setMarketing(existingConsent.marketing)
    }
  }, [])

  // Escuchar evento global para reabrir modal desde footer o página de política
  useEffect(() => {
    const handleOpenModal = () => {
      const consent = getStoredCookieConsent()
      if (consent) {
        setFunctional(consent.functional)
        setAnalytics(consent.analytics)
        setMarketing(consent.marketing)
      }
      setIsModalOpen(true)
    }

    window.addEventListener(OPEN_COOKIE_MODAL_EVENT, handleOpenModal)
    return () => window.removeEventListener(OPEN_COOKIE_MODAL_EVENT, handleOpenModal)
  }, [])

  if (!mounted) return null

  const handleAcceptAll = () => {
    acceptAllCookies()
    setFunctional(true)
    setAnalytics(true)
    setMarketing(true)
    setIsVisible(false)
    setIsModalOpen(false)
  }

  const handleAcceptNecessaryOnly = () => {
    acceptOnlyNecessaryCookies()
    setFunctional(false)
    setAnalytics(false)
    setMarketing(false)
    setIsVisible(false)
    setIsModalOpen(false)
  }

  const handleSavePreferences = () => {
    saveCookieConsent({
      functional,
      analytics,
      marketing,
    })
    setIsVisible(false)
    setIsModalOpen(false)
  }

  const handleOpenPreferencesModal = () => {
    setIsModalOpen(true)
  }

  return (
    <>
      {/* Banner flotante en la parte inferior */}
      {isVisible && (
        <aside
          role="dialog"
          aria-label="Consentimiento de cookies y privacidad"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-2xl border border-border/80 bg-background/95 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 md:p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">
                    Privacidad y Control Ético de Cookies
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" /> Transparencia
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Utilizamos cookies esenciales para el inicio de sesión, la seguridad en el procesamiento de reservas y pagos de canchas. Puedes decidir libremente si permites cookies adicionales para análisis y personalización. Consulta nuestra{" "}
                  <Link
                    href="/cookies"
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Política de Cookies
                  </Link>{" "}
                  y{" "}
                  <Link
                    href="/privacidad"
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPreferencesModal}
                className="order-3 gap-1.5 text-xs font-medium sm:order-1"
              >
                <Settings className="h-3.5 w-3.5" />
                Personalizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcceptNecessaryOnly}
                className="order-2 text-xs font-medium sm:order-2"
              >
                Solo Esenciales
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAcceptAll}
                className="order-1 text-xs font-semibold shadow-sm sm:order-3"
              >
                Aceptar Todas
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal Granular de Configuración Ética de Cookies */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <DialogTitle className="text-xl font-bold">
                Centro de Preferencias de Cookies
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
              En TuCancha respetamos tu privacidad y la seguridad de tus transacciones monetarias. Configura de forma transparente las categorías de cookies que autorizas utilizar en este dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Categoría 1: Esenciales */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      1. Cookies Técnicas y Esenciales
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <Lock className="h-3 w-3" /> Obligatorias
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Son estrictamente indispensables para que puedas navegar, autenticarte con seguridad, verificar tu sesión y procesar transacciones y reservas de canchas sin riesgo de fraude. No se pueden desactivar.
                  </p>
                </div>
                <Switch checked={true} disabled aria-label="Cookies esenciales siempre activadas" />
              </div>
            </div>

            {/* Categoría 2: Funcionales */}
            <div className="rounded-xl border border-border/80 p-4 transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      2. Cookies Funcionales y de Preferencias
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Opcional
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Permiten recordar tus preferencias de búsqueda (como tu club o distrito preferido, vista semanal del calendario y tema de color) para brindarte una navegación más fluida y personalizada.
                  </p>
                </div>
                <Switch
                  checked={functional}
                  onCheckedChange={setFunctional}
                  aria-label="Permitir cookies funcionales"
                />
              </div>
            </div>

            {/* Categoría 3: Analíticas */}
            <div className="rounded-xl border border-border/80 p-4 transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      3. Cookies de Rendimiento y Análisis
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Opcional
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nos ayudan a entender de forma anónima y agregada cómo interactúan los usuarios con la plataforma, detectar errores de carga en horarios de alta demanda y optimizar la velocidad del sistema.
                  </p>
                </div>
                <Switch
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-label="Permitir cookies analíticas"
                />
              </div>
            </div>

            {/* Categoría 4: Marketing */}
            <div className="rounded-xl border border-border/80 p-4 transition-colors hover:bg-muted/20">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      4. Cookies de Publicidad y Promociones
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Opcional
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Utilizadas para mostrarte ofertas relevantes de clubes deportivos, torneos y promociones especiales según tu zona deportiva. Vienen desactivadas por defecto.
                  </p>
                </div>
                <Switch
                  checked={marketing}
                  onCheckedChange={setMarketing}
                  aria-label="Permitir cookies de publicidad"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p>
              Tu consentimiento se almacena de forma local y segura. Puedes revocar o cambiar tus elecciones en cualquier momento desde el enlace de <strong>Configuración de Cookies</strong> ubicado en el pie de página de la plataforma.
            </p>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAcceptNecessaryOnly}
              className="text-xs"
            >
              Rechazar No Esenciales
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSavePreferences}
              className="text-xs font-semibold"
            >
              Guardar mi Selección
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleAcceptAll}
              className="text-xs font-bold"
            >
              Aceptar Todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
