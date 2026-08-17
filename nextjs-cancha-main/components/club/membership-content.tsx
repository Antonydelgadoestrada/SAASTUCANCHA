"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format, differenceInDays, isAfter } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2Icon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
  CreditCardIcon,
  ArrowRightIcon,
  Loader2Icon,
  SparklesIcon,
  ReceiptIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  getActiveMembershipPlans,
  getMyClubMembership,
  getMyMembershipPayments,
  createMembershipCheckout,
  cancelMembershipAutoRenew,
  checkMembershipPaymentStatus,
  MembershipPlan,
  ClubMembership,
  MembershipPayment,
} from "@/lib/membership"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function MembershipContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const paymentQueryParam = searchParams.get("payment")
  const paymentIdParam = searchParams.get("payment_id")

  // 1. Cargar membresía activa del club
  const {
    data: membershipData,
    isLoading: isLoadingMembership,
    refetch: refetchMembership,
  } = useQuery({
    queryKey: ["club-membership"],
    queryFn: getMyClubMembership,
  })

  // 2. Cargar planes disponibles
  const {
    data: plans = [],
    isLoading: isLoadingPlans,
  } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: getActiveMembershipPlans,
  })

  // 3. Cargar historial de pagos
  const {
    data: payments = [],
    isLoading: isLoadingPayments,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ["membership-payments"],
    queryFn: getMyMembershipPayments,
  })

  // 4. Manejar retorno de Mercado Pago
  useEffect(() => {
    if (paymentQueryParam === "success" && paymentIdParam) {
      setIsCheckingPayment(true)
      checkMembershipPaymentStatus(paymentIdParam)
        .then((res) => {
          if (res.status === "PAID") {
            toast.success("¡Pago confirmado! Tu membresía ha sido activada exitosamente.")
            refetchMembership()
            refetchPayments()
          } else {
            toast.info("Pago en proceso de confirmación por Mercado Pago.")
          }
        })
        .catch(() => {
          toast.info("Tu pago está siendo procesado por Mercado Pago.")
        })
        .finally(() => {
          setIsCheckingPayment(false)
        })
    } else if (paymentQueryParam === "failure") {
      toast.error("El pago no se pudo completar. Por favor intenta nuevamente.")
    }
  }, [paymentQueryParam, paymentIdParam, refetchMembership, refetchPayments])

  // 5. Mutación para crear preferencia de Mercado Pago
  const checkoutMutation = useMutation({
    mutationFn: (planId: string) => createMembershipCheckout(planId, true),
    onMutate: (planId) => {
      setSelectedPlanId(planId)
    },
    onSuccess: (data) => {
      if (data.init_point) {
        toast.loading("Redirigiendo a Mercado Pago...")
        window.location.href = data.init_point
      } else {
        toast.error("No se pudo obtener el link de pago de Mercado Pago.")
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Error al iniciar el pago con Mercado Pago.")
    },
    onSettled: () => {
      setSelectedPlanId(null)
    },
  })

  // 6. Mutación para cancelar auto-renovación
  const cancelMutation = useMutation({
    mutationFn: cancelMembershipAutoRenew,
    onSuccess: () => {
      toast.success("Renovación automática cancelada. Mantendrás acceso hasta el fin de tu periodo.")
      queryClient.invalidateQueries({ queryKey: ["club-membership"] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Error al cancelar renovación.")
    },
  })

  const currentMembership: ClubMembership | null = membershipData?.membership || null

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 px-3 py-1 text-sm font-medium">
            <ShieldCheckIcon className="h-4 w-4" /> Activa
          </Badge>
        )
      case "GRACE":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 px-3 py-1 text-sm font-medium">
            <AlertTriangleIcon className="h-4 w-4" /> En Periodo de Gracia
          </Badge>
        )
      case "EXPIRED":
        return (
          <Badge variant="destructive" className="gap-1 px-3 py-1 text-sm font-medium">
            <XCircleIcon className="h-4 w-4" /> Vencida
          </Badge>
        )
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm font-medium">
            <ClockIcon className="h-4 w-4" /> Cancelada
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 px-3 py-1 text-sm font-medium">
            Sin Membresía
          </Badge>
        )
    }
  }

  const getIntervalLabel = (interval: string) => {
    switch (interval) {
      case "ANNUAL":
        return "año"
      case "SEMIANNUAL":
        return "6 meses"
      case "MONTHLY":
      default:
        return "mes"
    }
  }

  if (isLoadingMembership || isLoadingPlans) {
    return (
      <div className="flex h-96 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando información de membresía...</p>
        </div>
      </div>
    )
  }

  const daysRemaining = currentMembership?.endDate
    ? differenceInDays(new Date(currentMembership.endDate), new Date())
    : 0

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Alerta de Retorno de Mercado Pago */}
      {paymentQueryParam === "success" && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="font-semibold text-lg">¡Pago Recibido con Éxito!</AlertTitle>
          <AlertDescription>
            Tu transacción ha sido procesada por Mercado Pago y tu membresía está en regla.
          </AlertDescription>
        </Alert>
      )}

      {paymentQueryParam === "failure" && (
        <Alert variant="destructive">
          <XCircleIcon className="h-5 w-5" />
          <AlertTitle className="font-semibold">No se pudo procesar el pago</AlertTitle>
          <AlertDescription>
            Hubo un problema al procesar el pago en Mercado Pago. Puedes intentar nuevamente con otro medio de pago.
          </AlertDescription>
        </Alert>
      )}

      {/* Encabezado y Estado Actual */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Membresía del Club</h1>
            <p className="text-muted-foreground mt-1">
              Administra tu suscripción para mantener tus canchas visibles en la plataforma y recibir reservas online.
            </p>
          </div>
          <div>{getStatusBadge(currentMembership?.status)}</div>
        </div>
      </div>

      {/* Tarjeta de Estado de Membresía Actual */}
      <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Estado de tu Suscripción
            </CardTitle>
            {currentMembership?.status === "ACTIVE" && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
                {daysRemaining > 0 ? `${daysRemaining} días restantes` : "Vence hoy"}
              </span>
            )}
          </div>
          <CardDescription>
            Información del plan actual y fechas de facturación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentMembership ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-background/80 border">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Plan Actual</span>
                <p className="text-lg font-bold text-foreground mt-0.5">
                  {currentMembership.plan?.name || "Plan Club"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Fecha de Inicio</span>
                <p className="text-base font-medium text-foreground mt-0.5">
                  {format(new Date(currentMembership.startDate), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Fecha de Vencimiento</span>
                <p className="text-base font-medium text-foreground mt-0.5">
                  {format(new Date(currentMembership.endDate), "dd 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Renovación Automática</span>
                <p className="text-base font-medium text-foreground mt-0.5 flex items-center gap-2">
                  {currentMembership.autoRenew && !currentMembership.cancelAtPeriodEnd ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2Icon className="h-4 w-4" /> Activada
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <XCircleIcon className="h-4 w-4" /> Desactivada
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed rounded-lg bg-muted/30">
              <AlertTriangleIcon className="h-10 w-10 text-amber-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold">No tienes una membresía activa</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Elige uno de los planes a continuación para publicar tus canchas y comenzar a recibir reservas de deportistas en TuCancha.
              </p>
            </div>
          )}

          {/* Advertencia si está en periodo de gracia */}
          {currentMembership?.status === "GRACE" && (
            <Alert className="border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
              <AlertTitle className="font-semibold">Tu membresía está en periodo de gracia</AlertTitle>
              <AlertDescription>
                Tienes hasta el {currentMembership.graceEndDate ? format(new Date(currentMembership.graceEndDate), "dd 'de' MMMM", { locale: es }) : "pronto"} para renovar antes de que tus canchas queden ocultas al público.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        {currentMembership && currentMembership.autoRenew && !currentMembership.cancelAtPeriodEnd && (
          <CardFooter className="border-t pt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="text-muted-foreground hover:text-destructive"
            >
              {cancelMutation.isPending && <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />}
              Cancelar Renovación Automática
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Planes Disponibles */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Planes de Membresía Disponibles</h2>
          <p className="text-muted-foreground">
            Pago 100% seguro procesado por Mercado Pago hacia la cuenta de la plataforma.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {plans.map((plan: MembershipPlan) => {
            const isCurrentPlan = currentMembership?.planId === plan.id && currentMembership?.status === "ACTIVE"
            const isProcessingThis = checkoutMutation.isPending && selectedPlanId === plan.id

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between transition-all duration-200 hover:shadow-md ${
                  isCurrentPlan ? "border-primary shadow-sm ring-1 ring-primary" : "border-border"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-primary text-primary-foreground text-xs font-semibold uppercase px-3">
                      Plan Actual
                    </Badge>
                  </div>
                )}
                <div>
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    <CardDescription>{plan.description || "Plan completo para complejos deportivos"}</CardDescription>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        S/ {Number(plan.price).toFixed(2)}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        / {getIntervalLabel(plan.interval)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                      Incluye:
                    </div>
                    <ul className="space-y-2.5 text-sm">
                      {Array.isArray(plan.features) && plan.features.length > 0 ? (
                        plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))
                      ) : (
                        <>
                          <li className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Publicación de canchas en el buscador</span>
                          </li>
                          <li className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Recepción de pagos directos con Mercado Pago</span>
                          </li>
                          <li className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Gestión de horarios y bloqueos recurrentes</span>
                          </li>
                        </>
                      )}
                      <li className="flex items-start gap-2 text-muted-foreground text-xs pt-1">
                        <ClockIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{plan.graceDays || 3} días de gracia ante vencimiento</span>
                      </li>
                    </ul>
                  </CardContent>
                </div>
                <CardFooter className="pt-4 border-t">
                  <Button
                    className="w-full font-semibold"
                    variant={isCurrentPlan ? "outline" : "default"}
                    disabled={checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    aria-label={`Suscribirme al plan ${plan.name} por S/ ${plan.price}`}
                  >
                    {isProcessingThis ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Conectando con Mercado Pago...
                      </>
                    ) : isCurrentPlan ? (
                      <>
                        <RefreshCwIcon className="h-4 w-4 mr-2" />
                        Renovar Suscripción
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="h-4 w-4 mr-2" />
                        Suscribirme con Mercado Pago
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Historial de Pagos de Membresía */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <ReceiptIcon className="h-5 w-5 text-muted-foreground" />
              Historial de Pagos de Membresía
            </h2>
            <p className="text-sm text-muted-foreground">
              Comprobantes y transacciones de suscripción procesadas.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchPayments()}>
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Referencia MP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No se registran pagos de membresía previos.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p: MembershipPayment) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{p.plan?.name || "Membresía Club"}</TableCell>
                    <TableCell className="font-semibold">
                      {p.currency} {Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {p.status === "PAID" ? (
                        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Aprobado</Badge>
                      ) : p.status === "PENDING" ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500">Pendiente</Badge>
                      ) : (
                        <Badge variant="destructive">Rechazado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {p.mpPaymentId || p.id.substring(0, 8)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
