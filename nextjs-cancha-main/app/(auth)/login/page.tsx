import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { LoginForm } from "@/components/auth/login-form"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: `Iniciar Sesión | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Inicia sesión en tu cuenta de process.env.NEXT_PUBLIC_APP_NAME",
}

export default function LoginPage() {
  return (
    <div className="container relative flex min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            src="/login.jpeg?height=1080&width=1920"
            width={1920}
            height={1080}
            alt="Canchas deportivas"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
       
        <Link
          href="/"
          className="relative z-20 flex items-center text-lg font-medium hover:underline"
        >
          <Image src="/favicon.png" alt="Logo" width={32} height={32} />
          {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>

        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;Esta plataforma ha revolucionado la forma en que gestionamos nuestras canchas deportivas. Ahora es
              mucho más fácil para nuestros clientes reservar y para nosotros administrar.&rdquo;
            </p>
            <footer className="text-sm">Club Deportivo Ejemplo</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar Sesión</h1>
            <p className="text-sm text-muted-foreground">Ingresa tus credenciales para acceder a tu cuenta</p>
          </div>
          <LoginForm />
          <p className="px-8 text-center text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link href="/register" className={cn(buttonVariants({ variant: "link" }), "px-0 text-primary")}>
              Regístrate
            </Link>
          </p>
           {/* Volver al inicio */}
          <p className="px-8 text-center text-sm text-muted-foreground">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "link" }), "text-primary px-0")}
            >
              ← Volver al inicio
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
