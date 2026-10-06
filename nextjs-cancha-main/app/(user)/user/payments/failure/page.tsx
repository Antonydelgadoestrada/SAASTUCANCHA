"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

function PaymentFailureContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id")
  const statusDetail = searchParams.get("status_detail")

  const getReasonMessage = (detail?: string | null) => {
    switch (detail) {
      case "cc_rejected_bad_filled_card_number":
        return "El número de tarjeta ingresado es incorrecto."
      case "cc_rejected_bad_filled_date":
        return "La fecha de vencimiento es incorrecta."
      case "cc_rejected_bad_filled_security_code":
        return "El código de seguridad (CVV) es incorrecto."
      case "cc_rejected_insufficient_amount":
        return "Tu tarjeta no cuenta con fondos suficientes para completar la operación."
      case "cc_rejected_call_for_authorize":
        return "Debes autorizar el pago llamando a tu entidad bancaria emisora."
      case "cc_rejected_card_disabled":
        return "Tu tarjeta no está habilitada para compras por internet."
      case "cc_rejected_max_attempts":
        return "Llegaste al límite de intentos permitidos con esta tarjeta."
      default:
        return "La transacción fue rechazada o cancelada en la pasarela de pagos."
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] w-full px-4 py-8 bg-transparent">
      <Card className="w-full max-w-md shadow-2xl border-red-500/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center shadow-inner">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
            No pudimos procesar tu pago
          </CardTitle>
          <CardDescription className="text-sm">
            {getReasonMessage(statusDetail)}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {paymentId && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono flex items-center justify-between">
              <span className="text-muted-foreground">ID Intento MP:</span>
              <span className="font-semibold text-foreground">{paymentId}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            No te preocupes: tu dinero no ha sido debitado. Puedes intentar pagar nuevamente con otra tarjeta o elegir otro método de pago (Yape, Plin o Transferencia).
          </p>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild className="w-full sm:flex-1" variant="default">
            <Link href="/user/bookings">
              <RefreshCw className="mr-2 w-4 h-4" /> Reintentar en Mis Reservas
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/search">
              <ArrowLeft className="mr-1.5 w-4 h-4" /> Explorar Canchas
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[85vh]">
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      }
    >
      <PaymentFailureContent />
    </Suspense>
  )
}
