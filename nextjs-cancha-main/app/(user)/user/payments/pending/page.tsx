"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Clock, ArrowRight, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyPayment } from "@/lib/mercadopago"

function PaymentPendingContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id")
  const externalReference = searchParams.get("external_reference")

  const [checking, setChecking] = useState(false)
  const [statusText, setStatusText] = useState("Tu pago se encuentra en proceso de aprobación.")

  const handleManualCheck = async () => {
    if (!paymentId) return
    setChecking(true)
    try {
      const res = await verifyPayment({ paymentId, externalReference: externalReference || undefined })
      if (res?.success || res?.status === "paid") {
        window.location.href = `/user/payments/success?payment_id=${paymentId}&status=approved&external_reference=${externalReference || ""}`
        return
      } else {
        setStatusText("El pago aún está en proceso por parte de Mercado Pago.")
      }
    } catch {
      setStatusText("Aún no se ha recibido la confirmación de la pasarela.")
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (paymentId) {
      handleManualCheck()
    }
  }, [paymentId])

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 bg-muted/20">
      <Card className="w-full max-w-lg shadow-lg border-amber-500/30">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Pago en Proceso
          </CardTitle>
          <CardDescription className="text-sm">
            {statusText}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {paymentId && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono flex items-center justify-between">
              <span className="text-muted-foreground">ID de Pago MP:</span>
              <span className="font-semibold text-foreground">{paymentId}</span>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">¿Pagaste por transferencia o agente bancario?</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                  La acreditación puede tardar entre unos minutos y hasta 24 horas según la entidad bancaria. Tu reserva se confirmará automáticamente en cuanto Mercado Pago valide la operación.
                </p>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            onClick={handleManualCheck}
            disabled={checking}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`mr-2 w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            Verificar Estado
          </Button>
          <Button asChild className="w-full sm:flex-1">
            <Link href="/user/bookings">
              Ir a Mis Reservas <ArrowRight className="ml-1.5 w-4 h-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[85vh]">
          <div className="flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando estado...</p>
          </div>
        </div>
      }
    >
      <PaymentPendingContent />
    </Suspense>
  )
}
