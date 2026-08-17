import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { AdminDashboardContent } from "@/components/admin/dashboard-content"

export const metadata: Metadata = {
  title: `Dashboard de Administrador | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: `Panel de control para administradores de ${process.env.NEXT_PUBLIC_APP_NAME}`,
}

export default async function AdminDashboardPage() {
  return (
    <AppLayout title="Dashboard de Administrador">
      <AdminDashboardContent />
    </AppLayout>
  )
}
