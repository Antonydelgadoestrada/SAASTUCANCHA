"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Calendar, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyPayment } from "@/lib/mercadopago"

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const paymentId = searchParams.get("payment_id") || searchParams.get("collection_id")
  const status = searchParams.get("status") || searchParams.get("collection_status")
  const externalReference = searchParams.get("external_reference")

  const [loading, setLoading] = useState(true)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function checkVerification() {
      if (!paymentId) {
        setLoading(false)
        return
      }

      try {
        const result = await verifyPayment({
          paymentId: String(paymentId),
          externalReference: externalReference || undefined,
          status: status || undefined,
        })
        if (isMounted) {
          setVerificationResult(result)
        }
      } catch (err: any) {
        console.warn("Error al verificar pago en backend:", err?.message || err)
        if (isMounted) {
          setErrorMsg(err?.message || "No pudimos sincronizar el estado en tiempo real, pero tu pago fue registrado.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    checkVerification()

    return () => {
      isMounted = false
    }
  }, [paymentId, externalReference])

  const booking = verificationResult?.booking
  const isApproved = status === "approved" || verificationResult?.status === "paid" || verificationResult?.success

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] w-full px-4 py-8 bg-transparent">
      <Card className="w-full max-w-md shadow-2xl border-emerald-500/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            {loading ? (
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center animate-pulse shadow-inner">
                <Clock className="w-12 h-12 text-emerald-600 animate-spin" />
              </div>
            ) : isApproved ? (
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-12 h-12 text-amber-600" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {loading
              ? "Verificando tu pago..."
              : isApproved
              ? "¡Pago Confirmado Exitosamente!"
              : "Pago Recibido en Proceso"}
          </CardTitle>
          <CardDescription className="text-sm">
            {loading
              ? "Estamos confirmando los detalles de tu reserva con Mercado Pago..."
              : isApproved
              ? "Tu transacción fue aprobada y tu turno quedó reservado."
              : "Estamos terminando de procesar los datos de tu reserva."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {paymentId && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs font-mono flex items-center justify-between">
              <span className="text-muted-foreground">ID Transacción MP:</span>
              <span className="font-semibold text-foreground">{paymentId}</span>
            </div>
          )}

          {booking && (
            <div className="space-y-2 border rounded-lg p-3 bg-card text-sm">
              {booking.bookingReference && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Código de Reserva:</span>
                  <span className="font-mono font-bold text-foreground">{booking.bookingReference}</span>
                </div>
              )}
              {booking.courtName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Cancha:
                  </span>
                  <span className="font-medium text-foreground text-right">{booking.courtName}</span>
                </div>
              )}
              {booking.clubName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Club:</span>
                  <span className="font-medium text-foreground text-right">{booking.clubName}</span>
                </div>
              )}
              {(booking.date || booking.startTime) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Horario:
                  </span>
                  <span className="font-medium text-foreground text-right">
                    {booking.date ? String(booking.date).substring(0, 10) : ""} {booking.startTime ? `(${booking.startTime} - ${booking.endTime})` : ""}
                  </span>
                </div>
              )}
              {booking.totalPrice && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-semibold">Total Pagado:</span>
                  <span className="font-bold text-emerald-600">S/ {Number(booking.totalPrice).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
              {errorMsg}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild className="w-full sm:flex-1" variant="default">
            <Link href="/user/bookings">
              Ver mis Reservas <ArrowRight className="ml-1.5 w-4 h-4" />
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/search">Buscar más canchas</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[85vh]">
          <div className="flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando confirmación...</p>
          </div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}
