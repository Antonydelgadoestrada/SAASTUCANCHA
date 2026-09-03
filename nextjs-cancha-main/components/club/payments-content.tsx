"use client"

import { PaymentSettingsTab } from "@/components/club/payment-settings-tab"

export function PaymentsContent() {
  return (
    <div className="p-6 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Medios de Pago
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura tus cuentas, billeteras digitales y métodos de cobro presencial.
          </p>
        </div>
      </div>

      {/* Contenido Principal */}
      <PaymentSettingsTab />
    </div>
  )
}
