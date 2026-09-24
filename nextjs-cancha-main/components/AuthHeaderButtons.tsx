// components/AuthHeaderButtons.tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/stores/userStore"

export const AuthHeaderButtons = () => {
  const user = useUserStore((state) => state.user)
  const router = useRouter()

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="h-8 sm:h-9 px-2.5 sm:px-4 text-xs sm:text-sm font-medium">
            Iniciar Sesión
          </Button>
        </Link>
        <Link href="/register?type=club">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 sm:h-9 px-2.5 sm:px-4 text-xs sm:text-sm font-medium shadow-xs">
            <span className="hidden xs:inline sm:inline">Registrar</span> Club
          </Button>
        </Link>
      </div>
    )
  }

  const handleRedirect = () => {
    if (user.role === "ADMIN") {
      router.push("/admin/dashboard")
    } else if (user.role === "CLUB") {
      router.push("/club/dashboard")
    } else {
      router.push('/user/dashboard')
    }
  }

  return (
    <Button size="sm" onClick={handleRedirect} className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-medium">
      Ir a mi Panel
    </Button>
  )
}
