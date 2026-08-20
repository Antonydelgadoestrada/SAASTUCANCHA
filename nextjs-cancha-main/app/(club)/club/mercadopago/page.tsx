import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: `Gestión de Pagos | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Administra los pagos de tu club deportivo",
}

export default function MercadoPagoRedirectPage() {
  redirect("/club/payments")
}
