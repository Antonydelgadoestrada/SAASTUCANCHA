import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ShieldCheck, DollarSign, Clock, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: `Términos y Condiciones | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Términos, condiciones de uso y políticas financieras de reservas en TuCancha",
}

export default function TerminosPage() {
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
          <Link href="/register">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al Registro
            </Button>
          </Link>
        </div>
      </header>

      <main className="container flex-1 max-w-4xl py-12 px-4 sm:px-6">
        <div className="space-y-4 border-b pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <FileText className="h-3.5 w-3.5" />
            Marco Legal y Comercial
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Términos y Condiciones del Servicio
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Última actualización: Septiembre de 2026. Por favor, lee con detenimiento este documento antes de crear una cuenta o realizar transacciones de dinero.
          </p>
        </div>

        {/* Resumen Financiero Clave */}
        <div className="my-8 rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">
                ¿Por qué es fundamental hablar de dinero y reservas?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                TuCancha es una plataforma que facilita el alquiler comercial de canchas deportivas donde se procesan reservas con dinero real (pagos en línea, adelantos/señas y liquidaciones en puerta). La reserva de un horario implica un bloqueo exclusivo del espacio, impidiendo que otros deportistas jueguen en ese turno. Por ello, ambas partes (usuario y club) asumen compromisos comerciales vinculantes.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-10 py-6 text-sm sm:text-base leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">1</span>
              Aceptación de los Términos
            </h3>
            <p className="text-muted-foreground">
              Al registrarte como Usuario Deportista o como Club Deportivo, declaras tener capacidad legal para contratar y aceptas de forma expresa y voluntaria estos Términos y Condiciones, así como nuestra Política de Privacidad y Política de Cookies.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">2</span>
              Gestión de Reservas y Tarifas
            </h3>
            <p className="text-muted-foreground">
              Cada complejo deportivo o club establece sus propias tarifas por bloque horario (30 minutos, 60 minutos, etc.), diferenciando tarifas diurnas, nocturnas y precios promocionales. TuCancha exhibe de manera clara y transparente el desglose del precio total antes de confirmar la reserva.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground text-sm">
              <li>El precio final incluye los servicios detallados en la publicación del club (luz nocturna, duchas, etc., cuando aplique).</li>
              <li>Las reservas sólo se consideran garantizadas cuando han sido abonadas en su totalidad o cuando se ha registrado la seña mínima acordada con el club.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">3</span>
              Métodos de Pago y Verificación de Transacciones
            </h3>
            <p className="text-muted-foreground">
              TuCancha soporta métodos de pago en línea homologados (como MercadoPago) y métodos manuales (transferencia bancaria, Yape, Plin y efectivo).
            </p>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs sm:text-sm text-destructive">
              <strong>Importante contra el Fraude:</strong> En los pagos por transferencia o billetera digital, el usuario debe subir comprobantes fidedignos. La presentación de comprobantes falsificados o adulterados constituye delito patrimonial, resultando en el bloqueo permanente de la cuenta y la entrega de antecedentes a las autoridades competentes.
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">4</span>
              Políticas de Cancelación, Reembolso y Penalidades
            </h3>
            <p className="text-muted-foreground">
              Para proteger la sostenibilidad operativa de los clubes y el derecho de los usuarios:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4 bg-muted/20">
                <h4 className="font-bold text-sm text-foreground mb-1">Cancelación con Anticipación (&gt; 24h)</h4>
                <p className="text-xs text-muted-foreground">
                  Permite la reprogramación del horario sin costo o la emisión de crédito a favor del usuario para futuras reservas, según la política interna de cada club.
                </p>
              </div>
              <div className="rounded-xl border p-4 bg-muted/20">
                <h4 className="font-bold text-sm text-foreground mb-1">Inasistencia o Cancelación Tardía (&lt; 24h)</h4>
                <p className="text-xs text-muted-foreground">
                  El club podrá retener la seña o pago abonado en concepto de indemnización por el lucro cesante del horario no utilizado.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">5</span>
              Obligaciones del Club Deportivo
            </h3>
            <p className="text-muted-foreground">
              El club asume la total responsabilidad por la aptitud física de sus canchas, la seguridad dentro del complejo, el cumplimiento estricto de los horarios contratados y la cortesía en la atención de los deportistas.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">6</span>
              Modificaciones y Contacto
            </h3>
            <p className="text-muted-foreground">
              TuCancha podrá actualizar estos términos para adecuarse a nuevas regulaciones o mejoras de la plataforma. Para consultas o reclamos, nuestro equipo está a tu disposición en <a href="mailto:Tucancha100@gmail.com" className="text-primary underline">Tucancha100@gmail.com</a> o vía WhatsApp al <a href="https://wa.me/51959493759" className="text-primary underline">+51 959 493 759</a>.
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
