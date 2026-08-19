import type { Metadata } from "next"

import { Suspense } from "react"

import { AppLayout } from "@/components/layout/app-layout"
import { ClubSchedulesContent } from "@/components/club/schedules-content"

export const metadata: Metadata = {
  title: `Horarios | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Gestiona los horarios de tus canchas deportivas",
}

export default async function ClubSchedulesPage() {
  return (
    <AppLayout title="Gestión de Horarios">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground font-semibold">Cargando horarios...</div>}>
        <ClubSchedulesContent />
      </Suspense>
    </AppLayout>
  )
}
