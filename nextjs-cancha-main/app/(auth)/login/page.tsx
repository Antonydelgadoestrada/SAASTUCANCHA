import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: `Iniciar Sesión | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: `Inicia sesión en tu cuenta de ${process.env.NEXT_PUBLIC_APP_NAME}`,
}

export default function LoginPage() {
  return (
    <div className="container relative min-h-screen flex flex-col items-center justify-center lg:grid lg:max-w-none lg:grid-cols-12 lg:px-0 bg-background/50">
      {/* Panel Izquierdo: Testimonios / Credenciales de Marca */}
      <div className="relative hidden h-full flex-col bg-zinc-950 p-10 text-white lg:flex lg:col-span-5 border-r border-border/10">
        {/* Imagen de Fondo de Alta Calidad */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/login.jpeg"
            alt="Canchas deportivas"
            fill
            sizes="40vw"
            className="object-cover opacity-25 filter grayscale-[20%]"
            priority
          />
          {/* Overlay de gradiente premium */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_var(--tw-gradient-stops))] from-zinc-950/70 via-zinc-950/40 to-zinc-950" />
        </div>

        {/* Logo / Link de Inicio */}
        <div className="relative z-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={20}
                height={20}
              />
            </div>
            <span className="bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
              {process.env.NEXT_PUBLIC_APP_NAME}
            </span>
          </Link>
        </div>

        {/* Sección de Recomendaciones para el uso adecuado de la plataforma */}
        <div className="relative z-10 mt-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <span>💡 Recomendaciones de uso</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
              Consejos para aprovechar al máximo TuCancha
            </h2>
            
            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl backdrop-blur-sm">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  ✓
                </div>
                <p>
                  <strong className="text-zinc-100">Disponibilidad en vivo:</strong> Consulta los horarios actualizados en tiempo real antes de reservar para asegurar tu cancha favorita.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl backdrop-blur-sm">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  ✓
                </div>
                <p>
                  <strong className="text-zinc-100">Comprobantes legibles:</strong> Si pagas con Yape o Transferencia, sube tu comprobante nítido con el código de operación visible para una rápida validación.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl backdrop-blur-sm">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  ✓
                </div>
                <p>
                  <strong className="text-zinc-100">Llega con anticipación:</strong> Preséntate de 10 a 15 minutos antes de tu horario pactado para el ingreso a la cancha.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl backdrop-blur-sm">
                <div className="mt-0.5 h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-[10px]">
                  ✓
                </div>
                <p>
                  <strong className="text-zinc-100">Revisa tu correo:</strong> Te enviaremos el comprobante, código de reserva y recordatorios antes de tu partido.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Login */}
      <div className="w-full lg:col-span-7 flex items-center justify-center p-4 sm:p-8 relative">
        {/* Glow de fondo decorativo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="mx-auto flex w-full flex-col justify-center space-y-6 max-w-[400px] bg-background/60 backdrop-blur-xl border border-border/50 p-6 sm:p-8 rounded-2xl shadow-xl shadow-zinc-950/5">
          <div className="flex flex-col space-y-2 text-center">
            <Link href="/" className="lg:hidden flex items-center justify-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Image src="/logo.png" alt="Logo" width={18} height={18} />
              </div>
              <span className="font-bold text-lg tracking-tight">{process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Iniciar Sesión</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          <LoginForm />

          <div className="space-y-2.5 pt-2 border-t border-border/40 text-center text-sm">
            <p className="text-muted-foreground">
              ¿No tienes una cuenta?{" "}
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "link" }), "px-0 text-primary font-semibold hover:underline")}
              >
                Regístrate
              </Link>
            </p>
            <p>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "link" }), "text-muted-foreground px-0 hover:text-foreground font-medium transition-colors")}
              >
                ← Volver al inicio
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
