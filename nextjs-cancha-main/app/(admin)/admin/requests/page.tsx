import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { AdminRequestsContent } from "@/components/admin/requests-content"

export const metadata: Metadata = {
  title: `Solicitudes Pendientes | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Gestión de solicitudes de clubes pendientes",
}

export default async function AdminRequestsPage() {
  return (
    <AppLayout title="Solicitudes Pendientes">
      <AdminRequestsContent />
    </AppLayout>
  )
}
