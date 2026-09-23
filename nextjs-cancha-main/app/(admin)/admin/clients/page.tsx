import type { Metadata } from "next"
import { AppLayout } from "@/components/layout/app-layout"
import { AdminClientsContent } from "@/components/admin/clients-content"

export const metadata: Metadata = {
  title: `Gestión de Clientes y Membresías | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Directorio de clubes con membresía activa, control de vigencias y alertas de vencimiento.",
}

export default async function AdminClientsPage() {
  return (
    <AppLayout title="Directorio de Clientes y Membresías">
      <AdminClientsContent />
    </AppLayout>
  )
}
