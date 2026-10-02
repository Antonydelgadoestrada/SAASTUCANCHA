import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { TransactionsContent } from "@/components/club/transactions-content"

export const metadata: Metadata = {
  title: `Transacciones | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Historial de ingresos y cobros de tu club deportivo",
}

export default async function ClubTransactionsPage() {
  return (
    <AppLayout title="Transacciones">
      <TransactionsContent />
    </AppLayout>
  )
}
