import type { Metadata } from "next"
import { AppLayout } from "@/components/layout/app-layout"
import { ClubUsersContent } from "@/components/club/users-content"

export const metadata: Metadata = {
  title: `Gestión de Usuarios | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Gestiona el equipo, recepcionistas y accesos de tu club",
}

export default async function ClubUsersPage() {
  return (
    <AppLayout title="Gestión de Usuarios">
      <ClubUsersContent />
    </AppLayout>
  )
}
