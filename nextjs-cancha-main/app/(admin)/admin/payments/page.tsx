import type { Metadata } from "next"
import { AppLayout } from "@/components/layout/app-layout"
import { AdminPaymentsContent } from "@/components/admin/payments-content"

export const metadata: Metadata = {
  title: `Gestor de Pagos de Membresías | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Registro de transacciones automáticas de pago de membresías realizadas por los clubes vía Mercado Pago.",
}

export default async function AdminPaymentsPage() {
  return (
    <AppLayout title="Gestor de Pagos de Membresías">
      <AdminPaymentsContent />
    </AppLayout>
  )
}
