import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { MaintenanceContent } from "@/components/club/maintenance-content"

export const metadata: Metadata = {
  title: `Mantenimiento | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Gestión de sedes, canchas y horarios para tu club deportivo",
}

export default async function MaintenancePage() {
  return (
    <AppLayout title="Mantenimiento">
      <MaintenanceContent />
    </AppLayout>
  )
}
