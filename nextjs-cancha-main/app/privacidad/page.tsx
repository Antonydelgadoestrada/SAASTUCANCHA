import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Shield, Lock, Eye, CheckCircle2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: `Política de Privacidad | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Tratamiento ético y protección de datos personales en TuCancha",
}

export default function PrivacidadPage() {
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
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Shield className="h-3.5 w-3.5" />
            Protección de Datos Personales
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Política de Privacidad y Tratamiento de Datos
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Tu privacidad y la seguridad de tus transacciones monetarias son una prioridad absoluta para TuCancha.
          </p>
        </div>

        <div className="space-y-10 py-8 text-sm sm:text-base leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">1. Principio Ético</h3>
            <p className="text-muted-foreground">
              En TuCancha no comercializamos, no vendemos ni alquilamos tus datos personales a terceros. La información que recopilamos tiene como única finalidad permitir la reserva de canchas deportivas, autenticar tu identidad de forma segura y facilitar la liquidación financiera con el complejo deportivo contratado.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">2. Datos Recopilados</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground text-sm">
              <li><strong>Datos de Identificación:</strong> Nombre, apellidos, dirección de correo electrónico y número de teléfono celular (para coordinaciones por WhatsApp y confirmaciones de reserva).</li>
              <li><strong>Datos de Transacción:</strong> Montos abonados, fecha y hora de la reserva, método de pago seleccionado y comprobantes emitidos.</li>
              <li><strong>Información del Club:</strong> Razón social, dirección del recinto deportivo, coordenadas geográficas, horarios de atención y datos de contacto comercial.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">3. Seguridad de las Transacciones Financieras</h3>
            <p className="text-muted-foreground">
              Toda la comunicación en la plataforma se realiza mediante cifrado de grado bancario SSL/TLS. Los pagos con tarjeta son procesados directamente por pasarelas de pago certificadas con estándares PCI-DSS (como MercadoPago). TuCancha nunca almacena números completos de tarjetas de crédito o débito ni códigos de seguridad CVV.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-foreground">4. Derechos ARCO</h3>
            <p className="text-muted-foreground">
              Como titular de tus datos, tienes derecho en cualquier momento a ejercer tus derechos de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong>, así como a revocar el consentimiento otorgado, enviando una comunicación formal a <a href="mailto:Tucancha100@gmail.com" className="text-primary underline">Tucancha100@gmail.com</a>.
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
