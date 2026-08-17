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
      <>
        <Link href="/login">
          <Button variant="ghost" className="hidden md:inline-flex">
            Iniciar Sesión
          </Button>
        </Link>
        <Link href="/register">
          <Button>Registrarse</Button>
        </Link>
      </>
    )
  }

  const handleRedirect = () => {
    if (user.role === "ADMIN") {
      router.push("/admin/dashboard")
    } else if (user.role === "CLUB") {
      router.push("/club/dashboard")
    } else {
      router.push('/user/bookings')
    }
  }

  return (
    <Button onClick={handleRedirect}>
      Ir a mi Panel
    </Button>
  )
}
