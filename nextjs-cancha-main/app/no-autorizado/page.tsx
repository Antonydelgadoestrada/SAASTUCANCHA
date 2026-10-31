"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { ShieldAlert, LogOut, LayoutDashboard, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NoAutorizadoPage() {
  const { data: session, status } = useSession()

  const role = session?.user?.role as string | undefined
  const email = session?.user?.email

  const getDashboardUrl = () => {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "CLUB" || role === "RECEPCIONISTA") return "/club/dashboard"
    return "/user/dashboard"
  }

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrador del Sistema",
    CLUB: "Administrador / Dueño de Club",
    RECEPCIONISTA: "Recepcionista de Club",
    USER: "Usuario / Jugador",
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-zinc-900/80 border border-zinc-800 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Brand / Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Image src="/logo.png" alt="TuCancha Logo" width={28} height={28} priority />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">TuCancha</span>
        </div>

        {/* Shield Alert Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          Acceso No Autorizado
        </h1>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
          Tu cuenta actual no cuenta con los permisos requeridos o el rol necesario para acceder a este apartado del sistema.
        </p>

        {/* Session Card Info */}
        {status === "authenticated" && (
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5 mb-6 text-left text-xs space-y-1.5">
            <div className="flex justify-between items-center text-zinc-400">
              <span>Cuenta activa:</span>
              <span className="font-mono text-zinc-200 truncate max-w-[190px]">{email}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400">
              <span>Rol asignado:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {role ? roleLabels[role] || role : "Sin rol"}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          {status === "authenticated" && (
            <Link href={getDashboardUrl()} className="w-full">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 h-10">
                <LayoutDashboard className="w-4 h-4" />
                Ir a mi panel asignado
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center gap-2 h-10"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión e ingresar con otra cuenta
          </Button>

          <Link href="/" className="w-full">
            <Button
              variant="ghost"
              className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800/40 flex items-center justify-center gap-2 h-9 text-xs"
            >
              <Home className="w-3.5 h-3.5" />
              Volver a la página principal
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
