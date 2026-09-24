import { Suspense } from "react"
import type { Metadata } from "next"
import { AppLayout } from "@/components/layout/app-layout"
import { AdminMercadopagoContent } from "@/components/admin/mercadopago-content"

export const metadata: Metadata = {
  title: `Conexión Mercado Pago Plataforma | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: "Conexión de la cuenta matriz de Mercado Pago para recaudar membresías de los clubes.",
}

export default function AdminMercadopagoPage() {
  return (
    <AppLayout title="Mercado Pago Plataforma">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando configuración de Mercado Pago...</div>}>
        <AdminMercadopagoContent />
      </Suspense>
    </AppLayout>
  )
}
