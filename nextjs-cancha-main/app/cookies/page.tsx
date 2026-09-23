import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Cookie, Settings, ShieldCheck, CheckCircle2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CookieTriggerButton } from "@/components/cookies/cookie-trigger-button"

export const metadata: Metadata = {
  title: `Política de Cookies | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Información transparente y ética sobre el uso de cookies en TuCancha",
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Logo" width={24} height={24} className="object-contain" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              {process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <CookieTriggerButton
              variant="default"
              className="text-xs font-semibold px-3 py-1.5 h-auto text-primary-foreground"
            />
            <Link href="/register">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container flex-1 max-w-4xl py-12 px-4 sm:px-6">
        <div className="space-y-4 border-b pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Cookie className="h-3.5 w-3.5" />
            Transparencia Digital
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Política de Cookies Ética y Profesional
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            En TuCancha creemos en el consentimiento informado y el respeto irrestricto a tu privacidad digital.
          </p>
        </div>

        {/* Panel para reabrir modal */}
        <div className="my-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-foreground text-base">¿Deseas modificar tus preferencias actuales?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Puedes cambiar tus elecciones o retirar tu consentimiento para cookies opcionales en cualquier momento.
            </p>
          </div>
          <CookieTriggerButton
            variant="default"
            className="text-sm font-bold px-4 py-2 text-primary-foreground h-auto shrink-0 shadow-sm"
          />
        </div>

        <div className="space-y-8 py-4 text-sm sm:text-base leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">1. ¿Qué son las Cookies?</h3>
            <p className="text-muted-foreground">
              Las cookies son pequeños archivos de texto que se almacenan de forma segura en tu navegador cuando visitas TuCancha. Permiten que la plataforma recuerde tu sesión de usuario activa, evite fraudes en transacciones de dinero y garantice que el sistema funcione con rapidez.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">2. Tabla de Cookies Utilizadas</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/50 border-b border-border text-foreground font-semibold">
                  <tr>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Finalidad</th>
                    <th className="p-3">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  <tr>
                    <td className="p-3 font-mono font-bold text-foreground">next-auth.session-token</td>
                    <td className="p-3"><span className="text-zinc-600 dark:text-zinc-400 font-semibold">Técnica (Obligatoria)</span></td>
                    <td className="p-3">Mantiene la sesión autenticada segura del deportista o administrador del club.</td>
                    <td className="p-3">Sesión / 30 días</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-foreground">__Host-next-auth.csrf-token</td>
                    <td className="p-3"><span className="text-zinc-600 dark:text-zinc-400 font-semibold">Técnica (Obligatoria)</span></td>
                    <td className="p-3">Protección contra ataques CSRF durante pagos y reservas.</td>
                    <td className="p-3">Sesión</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-foreground">tucancha_cookie_consent_v1</td>
                    <td className="p-3"><span className="text-zinc-600 dark:text-zinc-400 font-semibold">Técnica (Obligatoria)</span></td>
                    <td className="p-3">Almacena de forma local tus preferencias de privacidad.</td>
                    <td className="p-3">1 año</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-foreground">sidebar:state</td>
                    <td className="p-3"><span className="text-primary font-semibold">Funcional (Opcional)</span></td>
                    <td className="p-3">Recuerda si el menú lateral del club está expandido o colapsado.</td>
                    <td className="p-3">7 días</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-foreground">theme</td>
                    <td className="p-3"><span className="text-primary font-semibold">Funcional (Opcional)</span></td>
                    <td className="p-3">Recuerda tu preferencia de modo oscuro o modo claro.</td>
                    <td className="p-3">Persistente</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">3. Cómo Administrar Cookies en tu Navegador</h3>
            <p className="text-muted-foreground">
              Además de nuestro panel de control interactivo, puedes configurar, bloquear o eliminar cookies en los ajustes de tu navegador web (Google Chrome, Mozilla Firefox, Safari, Microsoft Edge). Ten en cuenta que si bloqueas las cookies técnicas necesarias, no será posible iniciar sesión ni realizar reservas de canchas.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}. Todos los derechos reservados.
      </footer>
    </div>
  )
}
