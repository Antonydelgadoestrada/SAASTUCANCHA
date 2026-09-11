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
  SmartphoneIcon,
  Building2Icon,
  UploadCloudIcon,
  FileTextIcon,
  EyeIcon,
  LockIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  getActiveMembershipPlans,
  getMyClubMembership,
  getMyMembershipPayments,
  createMembershipCheckout,
  submitMembershipManualPayment,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

  // Estado para Modal de Pago Manual (Yape / Plin / Transferencia)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualPlan, setManualPlan] = useState<MembershipPlan | null>(null)
  const [manualMethod, setManualMethod] = useState<"YAPE" | "PLIN" | "TRANSFERENCIA">("YAPE")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [manualNotes, setManualNotes] = useState("")
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)

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
            queryClient.invalidateQueries({ queryKey: ["club-profile"] })
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
  }, [paymentQueryParam, paymentIdParam, refetchMembership, refetchPayments, queryClient])

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

  // 6. Mutación para enviar pago manual y comprobante (Reactivación Inmediata)
  const manualPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!manualPlan) throw new Error("No hay plan seleccionado")
      if (!comprobanteFile) throw new Error("Por favor adjunta la foto o captura del comprobante de pago")

      const formData = new FormData()
      formData.append("planId", manualPlan.id)
      formData.append("paymentMethod", manualMethod)
      if (referenceNumber) formData.append("referenceNumber", referenceNumber)
      if (manualNotes) formData.append("notes", manualNotes)
      formData.append("comprobante", comprobanteFile)

      return submitMembershipManualPayment(formData)
    },
    onSuccess: () => {
      toast.success("¡Comprobante enviado y cuenta reactivada con éxito!", {
        description: "Tu membresía se ha actualizado inmediatamente. Ya tienes acceso a todas las funciones del club.",
      })
      setIsManualModalOpen(false)
      setComprobanteFile(null)
      setComprobantePreview(null)
      setReferenceNumber("")
      setManualNotes("")
      refetchMembership()
      refetchPayments()
      queryClient.invalidateQueries({ queryKey: ["club-profile"] })
      queryClient.invalidateQueries({ queryKey: ["club-membership"] })
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || "Error al enviar el comprobante de pago")
    },
  })

  // 7. Mutación para cancelar auto-renovación
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
          <Badge variant="outline" className="gap-1 px-3 py-1 text-sm font-medium border-amber-400 text-amber-600">
            ⚠️ Pago Pendiente
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

  const handleOpenManualPayment = (plan: MembershipPlan) => {
    setManualPlan(plan)
    setIsManualModalOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setComprobanteFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setComprobantePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
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

  const isSuspended = !currentMembership || currentMembership.status === "EXPIRED"

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Alerta de Retorno de Mercado Pago */}
      {paymentQueryParam === "success" && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
          <AlertTitle className="font-semibold text-lg">¡Pago Recibido con Éxito!</AlertTitle>
          <AlertDescription>
            Tu transacción ha sido procesada y tu membresía está 100% activa. Ya puedes utilizar todos los módulos del club.
          </AlertDescription>
        </Alert>
      )}

      {paymentQueryParam === "failure" && (
        <Alert variant="destructive">
          <XCircleIcon className="h-5 w-5" />
          <AlertTitle className="font-semibold">No se pudo procesar el pago online</AlertTitle>
          <AlertDescription>
            Hubo un problema con Mercado Pago. Puedes intentar nuevamente o realizar el pago manual por Yape, Plin o Transferencia.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta si la cuenta está suspendida por falta de pago */}
      {isSuspended && (
        <Alert variant="destructive" className="border-2 border-red-500 bg-red-50 dark:bg-red-950/40 text-red-950 dark:text-red-100">
          <AlertTriangleIcon className="h-6 w-6 text-red-600 animate-pulse" />
          <AlertTitle className="font-bold text-lg">⚠️ Acceso Limitado: Regularización de Membresía Requerida</AlertTitle>
          <AlertDescription className="text-sm mt-1">
            Tu mensualidad o periodo de prueba ha concluido. Para reactivar tu cuenta y desbloquear el panel de canchas, horarios y reservas, selecciona un plan y envía tu pago a continuación. <strong>La reactivación es inmediata una vez enviado el pago.</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Encabezado y Estado Actual */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Membresía del Club</h1>
            <p className="text-muted-foreground mt-1">
              Administra tu suscripción mensual para mantener tus canchas visibles al público y habilitar todas las operaciones del club.
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
                    <span className="text-emerald-600 flex items-center gap-1 font-semibold">
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
              <h3 className="text-lg font-semibold">Sin membresía activa</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Elige uno de los planes a continuación para reactivar tu cuenta, publicar tus canchas y comenzar a recibir reservas en TuCancha.
              </p>
            </div>
          )}

          {/* Advertencia si está en periodo de gracia */}
          {currentMembership?.status === "GRACE" && (
            <Alert className="border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
              <AlertTitle className="font-semibold">Tu membresía está en periodo de gracia</AlertTitle>
              <AlertDescription>
                Tienes hasta el {currentMembership.graceEndDate ? format(new Date(currentMembership.graceEndDate), "dd 'de' MMMM", { locale: es }) : "pronto"} para renovar antes de que tus funciones queden suspendidas.
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
            Puedes pagar en línea con Mercado Pago o mediante pago manual (Yape, Plin o Transferencia bancaria).
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
                            <span>Recepción de pagos automáticos (Mercado Pago)</span>
                          </li>
                          <li className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Recepción de pagos manuales (Yape y Plin)</span>
                          </li>
                          <li className="flex items-start gap-2 text-foreground/90">
                            <CheckCircle2Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Gestión de horarios, reservas y bloqueos</span>
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
                <CardFooter className="pt-4 border-t flex flex-col gap-2.5">
                  <Button
                    className="w-full font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate(plan.id)}
                  >
                    {isProcessingThis ? (
                      <>
                        <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                        Conectando Mercado Pago...
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="h-4 w-4 mr-2" />
                        Pagar con Mercado Pago
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full font-medium text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 gap-1.5"
                    onClick={() => handleOpenManualPayment(plan)}
                  >
                    <SmartphoneIcon className="h-3.5 w-3.5" />
                    Pagar con Yape / Plin / Transferencia
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
                <TableHead>Método</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Comprobante / Ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
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
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {p.paymentMethod || p.paymentType || "Mercado Pago"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {p.currency} {Number(p.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {p.status === "PAID" ? (
                        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Aprobado ✓</Badge>
                      ) : p.status === "PENDING" ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500">En Revisión</Badge>
                      ) : (
                        <Badge variant="destructive">Rechazado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.comprobanteUrl ? (
                        <a
                          href={p.comprobanteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          <FileTextIcon className="w-3.5 h-3.5" />
                          Ver Voucher
                        </a>
                      ) : (
                        <span className="font-mono text-muted-foreground">{p.mpPaymentId || p.id.substring(0, 8)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          MODAL DE PAGO MANUAL (YAPE, PLIN, TRANSFERENCIA)
      ─────────────────────────────────────────────────────────────────── */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <SmartphoneIcon className="w-5 h-5 text-purple-600" />
              Pago Manual de Membresía ({manualPlan?.name})
            </DialogTitle>
            <DialogDescription>
              Realiza la transferencia o pago por Yape/Plin a la cuenta oficial de TuCancha y sube tu comprobante para reactivar tu cuenta de inmediato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Resumen del Plan */}
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Plan Seleccionado</p>
                <p className="font-bold text-foreground">{manualPlan?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Monto a Cancelar</p>
                <p className="text-xl font-black text-purple-600 dark:text-purple-400">
                  S/ {Number(manualPlan?.price || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Selector de Método Manual */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Selecciona tu método de pago
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "YAPE", label: "🟣 Yape" },
                  { id: "PLIN", label: "🟢 Plin" },
                  { id: "TRANSFERENCIA", label: "🏦 Transferencia" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setManualMethod(m.id as any)}
                    className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                      manualMethod === m.id
                        ? "border-purple-500 bg-purple-100/50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500"
                        : "border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Datos Oficiales de la Plataforma */}
            <div className="p-4 bg-muted/40 rounded-xl border text-xs space-y-2.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Building2Icon className="w-4 h-4 text-primary" />
                Cuentas Oficiales de TuCancha:
              </p>
              {manualMethod === "YAPE" && (
                <div className="space-y-1">
                  <p><strong>Número Yape:</strong> 999 888 777</p>
                  <p><strong>Titular:</strong> TuCancha S.A.C.</p>
                </div>
              )}
              {manualMethod === "PLIN" && (
                <div className="space-y-1">
                  <p><strong>Número Plin:</strong> 999 888 777</p>
                  <p><strong>Titular:</strong> TuCancha S.A.C.</p>
                </div>
              )}
              {manualMethod === "TRANSFERENCIA" && (
                <div className="space-y-1">
                  <p><strong>Banco:</strong> BCP / Interbank</p>
                  <p><strong>Cuenta Corriente:</strong> 191-99887766-0-12</p>
                  <p><strong>CCI:</strong> 002-191-009988776601-23</p>
                  <p><strong>Titular:</strong> TuCancha S.A.C.</p>
                </div>
              )}
            </div>

            {/* Subir Comprobante / Voucher */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Foto o Captura del Comprobante *</span>
                {comprobanteFile && <span className="text-emerald-600 font-semibold">✓ Archivo cargado</span>}
              </Label>
              <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/20 transition-colors">
                <input
                  type="file"
                  id="voucher-upload"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="voucher-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <UploadCloudIcon className="w-8 h-8 text-purple-600" />
                  <span className="text-xs font-semibold text-foreground">
                    {comprobanteFile ? comprobanteFile.name : "Haz clic aquí para seleccionar o arrastrar el voucher"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">PNG, JPG, WEBP hasta 10MB</span>
                </label>
              </div>

              {comprobantePreview && (
                <div className="mt-2 max-h-40 rounded-lg overflow-hidden border flex items-center justify-center bg-black/5 p-2">
                  <img src={comprobantePreview} alt="Preview voucher" className="max-h-36 object-contain rounded" />
                </div>
              )}
            </div>

            {/* Número de Operación */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Número de Operación / Referencia (Opcional)</Label>
              <Input
                placeholder="Ej. 12984719"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notas adicionales (Opcional)</Label>
              <Textarea
                placeholder="Ej. Pago correspondiente a la mensualidad de este mes..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              onClick={() => setIsManualModalOpen(false)}
              disabled={manualPaymentMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex-1 gap-2"
              onClick={() => manualPaymentMutation.mutate()}
              disabled={manualPaymentMutation.isPending || !comprobanteFile}
            >
              {manualPaymentMutation.isPending ? (
                <>
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                  Enviando Comprobante...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="w-4 h-4" />
                  Enviar Comprobante y Reactivar Cuenta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
