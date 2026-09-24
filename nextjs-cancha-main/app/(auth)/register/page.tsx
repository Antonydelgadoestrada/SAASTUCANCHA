import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { RegisterForm } from "@/components/auth/register-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: `Registro | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: `Crea una cuenta en ${process.env.NEXT_PUBLIC_APP_NAME}`,
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}) {
  const resolvedParams = await searchParams;
  const type = resolvedParams?.type ?? ("user" as string | undefined);
  const isClub = type === "club";

  return (
    <div className="container relative min-h-screen py-8 lg:py-0 flex items-center justify-center lg:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            // src="/placeholder.svg?height=1080&width=1920"
            src="/login.jpeg?height=1080&width=1920"
            width={1920}
            height={1080}
            alt="Canchas deportivas"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <Link
          href="/"
          className="relative z-20 flex items-center gap-2 text-lg font-medium hover:underline"
        >
          <Image src="/favicon.png" alt="Logo" width={28} height={28} />
          {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;
              {isClub
                ? `Registra tu club deportivo en ${process.env.NEXT_PUBLIC_APP_NAME} y aumenta tus reservas. Nuestra plataforma te ayudará a gestionar tus canchas de manera eficiente.`
                : `Registrarte en ${process.env.NEXT_PUBLIC_APP_NAME} te dará acceso a las mejores canchas deportivas de la ciudad, con reservas fáciles y rápidas.`}
              &rdquo;
            </p>
            <footer className="text-sm">
              Equipo {process.env.NEXT_PUBLIC_APP_NAME}
            </footer>
          </blockquote>
        </div>
      </div>
      <div className="w-full p-4 sm:p-8">
        <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-6">
          <div className="flex flex-col space-y-2 text-center">
            <Link href="/" className="lg:hidden flex items-center justify-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Image src="/logo.png" alt="Logo" width={18} height={18} />
              </div>
              <span className="font-bold text-lg tracking-tight">{process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}</span>
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">
              Crear una cuenta
            </h1>
            <p className="text-sm text-muted-foreground">
              {isClub
                ? `Ingresa los datos de tu club deportivo para registrarte en ${process.env.NEXT_PUBLIC_APP_NAME}`
                : `Ingresa tus datos para registrarte en ${process.env.NEXT_PUBLIC_APP_NAME}`}
            </p>
          </div>
          {/* <RegisterForm defaultType={isClub ? "CLUB" : "USER"} /> */}
          <RegisterForm />

          <p className="px-8 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "link" }),
                "px-0 text-primary"
              )}
            >
              Iniciar sesión
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
  );
}
