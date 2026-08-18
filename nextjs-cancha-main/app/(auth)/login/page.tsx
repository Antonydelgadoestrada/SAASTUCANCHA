import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Quote, Star } from "lucide-react"

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

        {/* Cita de Testimonio y Confianza */}
        <div className="relative z-10 mt-auto space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Quote className="h-6 w-6" />
          </div>

          <blockquote className="space-y-4">
            <p className="text-xl font-medium leading-relaxed text-zinc-100">
              &ldquo;Esta plataforma ha revolucionado la forma en que gestionamos nuestras canchas deportivas. Ahora es mucho más fácil para nuestros clientes reservar y para nosotros administrar.&rdquo;
            </p>
            <footer className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-primary">
                CD
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Club Deportivo Ejemplo</p>
                <div className="flex items-center gap-0.5 mt-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Login */}
      <div className="w-full lg:col-span-7 flex items-center justify-center p-4 sm:p-8 relative">
        {/* Glow de fondo decorativo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-primary/5 rounded-full blur-3xl -z-10" />

        <div className="mx-auto flex w-full flex-col justify-center space-y-6 max-w-[400px] bg-background/60 backdrop-blur-xl border border-border/50 p-6 sm:p-8 rounded-2xl shadow-xl shadow-zinc-950/5">
          <div className="flex flex-col space-y-2 text-center">
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
