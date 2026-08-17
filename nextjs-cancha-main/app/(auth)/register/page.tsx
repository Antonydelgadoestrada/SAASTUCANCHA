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

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const type = searchParams?.type ?? ("user" as string | undefined);
  const isClub = type === "club";

  return (
    <div className="container relative h-screen items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
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
          className="relative z-20 flex items-center text-lg font-medium hover:underline"
        >
          <Image src="/favicon.png" alt="Logo" width={32} height={32} />
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
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
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
