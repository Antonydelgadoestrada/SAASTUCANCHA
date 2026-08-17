import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { PaymentsContent } from "@/components/club/payments-content"

export const metadata: Metadata = {
  title: `Gestión de Pagos | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Administra los pagos de tu club deportivo",
}

export default async function ClubPaymentsPage() {
  return (
    <AppLayout title="Gestión de Pagos">
      <PaymentsContent />
    </AppLayout>
  )
}
