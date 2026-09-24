"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  CreditCardIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  ServerIcon,
  ArrowRightIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ZapIcon,
  HelpCircleIcon,
  WifiIcon,
  Building2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  getAdminMercadoPagoStatus,
  getAdminMercadoPagoAuthorizeUrl,
  disconnectAdminMercadoPago,
  syncAdminMercadoPago,
  saveAdminManualCredentials,
  PlatformMercadoPagoStatus,
  PlatformSyncResult,
} from "@/lib/admin-mercadopago"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function AdminMercadopagoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<PlatformMercadoPagoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [testingPing, setTestingPing] = useState(false)
  const [pingResult, setPingResult] = useState<PlatformSyncResult | null>(null)

  // Modales
  const [showManualModal, setShowManualModal] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Credenciales manuales form
  const [manualToken, setManualToken] = useState("")
  const [manualPublicKey, setManualPublicKey] = useState("")
  const [showTokenText, setShowTokenText] = useState(false)
  const [savingManual, setSavingManual] = useState(false)

  // Estados de copiado
  const [copiedRedirect, setCopiedRedirect] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const data = await getAdminMercadoPagoStatus()
      setStatus(data)
    } catch (err: any) {
      toast.error("Error al cargar estado de Mercado Pago", {
        description: err?.response?.data?.message || err?.message,
      })
    } finally {
      setLoading(false)
    }
  }

  // Manejo de callbacks OAuth en URL
  useEffect(() => {
    fetchStatus()

    const oauthStatus = searchParams.get("status")
    const oauthError = searchParams.get("error")
    const oauthReason = searchParams.get("reason")

    if (oauthStatus === "connected") {
      toast.success("¡Mercado Pago conectado con éxito!", {
        description: "La cuenta de la plataforma ha quedado vinculada para recibir suscripciones de clubes.",
      })
      router.replace("/admin/mercadopago")
    } else if (oauthError) {
      toast.error("Error en vinculación con Mercado Pago", {
        description: oauthReason || oauthError,
      })
      router.replace("/admin/mercadopago")
    }
  }, [searchParams])

  const handleOAuthConnect = async () => {
    try {
      setConnecting(true)
      const url = await getAdminMercadoPagoAuthorizeUrl()
      if (url) {
        toast.info("Redirigiendo a Mercado Pago para inicio de sesión seguro...")
        window.location.href = url
      } else {
        toast.error("No se pudo obtener el enlace de autorización")
      }
    } catch (err: any) {
      toast.error("Error al iniciar autorización OAuth", {
        description: err?.response?.data?.message || err?.message,
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleTestPing = async () => {
    try {
      setTestingPing(true)
      const res = await syncAdminMercadoPago()
      setPingResult(res)
      toast.success(`Conexión verificada (${res.latencyMs}ms)`, {
        description: `Cuenta activa: ${res.accountEmail || res.accountNickname || "OK"}`,
      })
      fetchStatus()
    } catch (err: any) {
      toast.error("Fallo de conexión con Mercado Pago", {
        description: err?.response?.data?.message || err?.message,
      })
    } finally {
      setTestingPing(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      await disconnectAdminMercadoPago()
      toast.success("Cuenta de Mercado Pago desconectada exitosamente")
      setShowDisconnectModal(false)
      fetchStatus()
    } catch (err: any) {
      toast.error("Error al desconectar cuenta", {
        description: err?.response?.data?.message || err?.message,
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) {
      toast.error("El Access Token es obligatorio")
      return
    }

    try {
      setSavingManual(true)
      await saveAdminManualCredentials({
        accessToken: manualToken.trim(),
        publicKey: manualPublicKey.trim() || undefined,
      })
      toast.success("Credenciales manuales guardadas y validadas exitosamente")
      setShowManualModal(false)
      setManualToken("")
      setManualPublicKey("")
      fetchStatus()
    } catch (err: any) {
      toast.error("Error al guardar credenciales", {
        description: err?.response?.data?.message || err?.message,
      })
    } finally {
      setSavingManual(false)
    }
  }

  const handleCopy = (text: string, type: "redirect" | "webhook") => {
    navigator.clipboard.writeText(text)
    if (type === "redirect") {
      setCopiedRedirect(true)
      setTimeout(() => setCopiedRedirect(false), 2000)
    } else {
      setCopiedWebhook(true)
      setTimeout(() => setCopiedWebhook(false), 2000)
    }
    toast.info("Copiado al portapapeles")
  }

  const isConnected = status?.isConnected ?? false
  const isEnvFallback = !isConnected && (status?.hasEnvFallback ?? false)
  const webhookUrl = status?.redirectUri
    ? status.redirectUri.replace("/payments/oauth/callback", "/memberships/webhook")
    : "http://localhost:3001/memberships/webhook"

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Mercado Pago Plataforma
            </h1>
            <Badge
              variant="outline"
              className={
                isConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isEnvFallback
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              }
            >
              {isConnected
                ? "Conectado vía OAuth"
                : isEnvFallback
                ? "Fallback Activo (.env)"
                : "Sin Conexión"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vincula la cuenta matriz de Mercado Pago para recaudar las membresías y pagos de suscripción de los clubes registrados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>

          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestPing}
              disabled={testingPing || loading}
              className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <WifiIcon className={`h-4 w-4 ${testingPing ? "animate-pulse" : ""}`} />
              {testingPing ? "Probando..." : "Test Ping"}
            </Button>
          )}
        </div>
      </div>

      {/* Hero Principal de Estado */}
      <Card className="overflow-hidden border border-border shadow-sm">
        <div
          className={`h-2 w-full ${
            isConnected
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : isEnvFallback
              ? "bg-gradient-to-r from-amber-500 to-yellow-400"
              : "bg-gradient-to-r from-red-500 to-orange-400"
          }`}
        />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
            {/* Información de la cuenta conectada */}
            <div className="space-y-4 lg:col-span-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 border border-blue-500/20 shadow-sm">
                  <CreditCardIcon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold">
                      {status?.accountNickname || (isConnected ? "Cuenta Matriz Mercado Pago" : "Sin Cuenta Vinculada")}
                    </h2>
                    {status?.environment && (
                      <Badge variant="secondary" className="uppercase text-xs font-mono">
                        {status.environment}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {status?.accountEmail ? (
                      <span className="font-medium text-foreground">{status.accountEmail}</span>
                    ) : (
                      "No se ha identificado ningún correo asociado."
                    )}
                  </p>
                  {status?.mpUserId && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Collector ID: <span className="font-semibold text-foreground">{status.mpUserId}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Grid de metadata operativa */}
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">Origen Credenciales</span>
                  <p className="mt-1 font-semibold text-xs capitalize text-foreground">
                    {status?.source === "database"
                      ? "Base de Datos (OAuth Dinámico)"
                      : status?.source === "environment"
                      ? "Archivo .env (Estático)"
                      : "No configurado"}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <span className="text-xs text-muted-foreground">Última Sincronización</span>
                  <p className="mt-1 font-semibold text-xs text-foreground">
                    {status?.lastSyncAt
                      ? format(parseISO(status.lastSyncAt), "dd/MM/yyyy HH:mm", { locale: es })
                      : "Nunca"}
                  </p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 col-span-2 sm:col-span-1">
                  <span className="text-xs text-muted-foreground">Vigencia del Token</span>
                  <p className="mt-1 font-semibold text-xs text-foreground">
                    {status?.expiresInDays !== null && status?.expiresInDays !== undefined
                      ? `${status.expiresInDays} días restantes`
                      : isConnected
                      ? "Indefinida / Auto-renovable"
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones de vinculación */}
            <div className="flex flex-col gap-3 lg:col-span-4 lg:border-l lg:pl-6">
              {!isConnected ? (
                <>
                  <Button
                    size="lg"
                    onClick={handleOAuthConnect}
                    disabled={connecting || loading || !status?.hasClientIdAndSecret}
                    className="w-full gap-2 bg-[#009ee3] hover:bg-[#0081ba] text-white shadow-sm font-semibold"
                  >
                    <ExternalLinkIcon className="h-5 w-5" />
                    {connecting ? "Conectando..." : "Iniciar Sesión con Mercado Pago"}
                  </Button>

                  {!status?.hasClientIdAndSecret && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Configura <code>MP_CLIENT_ID</code> y <code>MP_CLIENT_SECRET</code> en el servidor para habilitar el flujo OAuth.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManualModal(true)}
                    className="w-full gap-2 text-xs"
                  >
                    <KeyRoundIcon className="h-4 w-4" />
                    Configurar Credenciales Manuales
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="default"
                    variant="outline"
                    onClick={handleOAuthConnect}
                    disabled={connecting}
                    className="w-full gap-2 text-xs"
                  >
                    <RefreshCwIcon className="h-4 w-4" />
                    Re-vincular Cuenta OAuth
                  </Button>

                  <Button
                    size="default"
                    variant="outline"
                    onClick={() => setShowManualModal(true)}
                    className="w-full gap-2 text-xs"
                  >
                    <KeyRoundIcon className="h-4 w-4" />
                    Actualizar Manualmente
                  </Button>

                  <Button
                    size="default"
                    variant="destructive"
                    onClick={() => setShowDisconnectModal(true)}
                    className="w-full gap-2 text-xs"
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Desconectar Cuenta
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Seguridad e Infraestructura */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Pilares de Seguridad */}
        <Card className="border border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-base">Arquitectura y Seguridad Criptográfica</CardTitle>
            </div>
            <CardDescription>
              Garantías de protección aplicadas en el backend según estándares bancarios y PCI DSS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Protección Anti-CSRF OAuth v2</p>
                <p className="text-xs text-muted-foreground">
                  El parámetro <code>state</code> utiliza un nonce aleatorio de 128 bits firmado con HMAC-SHA256 y ventana estricta de 15 minutos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Zero-Leakage (Cero Filtración de Tokens)</p>
                <p className="text-xs text-muted-foreground">
                  Los tokens <code>mpAccessToken</code> y <code>mpRefreshToken</code> están excluidos por defecto (<code>select: false</code>) en ORM y nunca se exponen al navegador.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Daemon de Auto-Renovación Proactivo</p>
                <p className="text-xs text-muted-foreground">
                  Un trabajo cron programado cada 4 horas y gatillos en tiempo de ejecución renuevan el token antes de vencer sin interrumpir pagos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Segregación de Pagos (Marketplace vs Plataforma)</p>
                <p className="text-xs text-muted-foreground">
                  Los pagos de canchas de deportistas van a los clubes. Las suscripciones de membresía de los clubes se abonan a esta cuenta matriz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* URLs de Integración en Mercado Pago Developers */}
        <Card className="border border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Endpoints de Mercado Pago Developers</CardTitle>
            </div>
            <CardDescription>
              Configura estas rutas en tu aplicación en el portal de desarrolladores de Mercado Pago.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                URL de Redirección OAuth (Redirect URI)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={status?.redirectUri || "http://localhost:3001/payments/oauth/callback"}
                  className="font-mono text-xs bg-muted/40"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    handleCopy(
                      status?.redirectUri || "http://localhost:3001/payments/oauth/callback",
                      "redirect"
                    )
                  }
                  className="shrink-0"
                >
                  {copiedRedirect ? (
                    <CheckIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Agrega esta URL exacta en la sección "URLs de redireccionamiento" de tu app MP.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Webhook de Notificaciones de Membresías
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs bg-muted/40"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(webhookUrl, "webhook")}
                  className="shrink-0"
                >
                  {copiedWebhook ? (
                    <CheckIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ruta independiente para notificaciones IPN/Webhooks de pagos de suscripción.
              </p>
            </div>

            <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Building2Icon className="h-4 w-4 text-blue-500" />
                <span>¿Cómo funciona el flujo de cobros?</span>
              </div>
              <p className="mt-1">
                Cuando un club suscribe un plan mensual o anual (Yape, Plin o Mercado Pago Checkout Pro), el abono se procesa y se acredita directamente en esta cuenta receptora vinculada.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Credenciales Manuales */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRoundIcon className="h-5 w-5 text-primary" />
              Configurar Credenciales Manuales
            </DialogTitle>
            <DialogDescription>
              Introduce el Access Token de producción o sandbox de Mercado Pago. El sistema validará la autenticidad antes de guardar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveManual} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="manual-token">
                Access Token de Mercado Pago <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="manual-token"
                  type={showTokenText ? "text" : "password"}
                  placeholder="APP_USR-..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="pr-10 font-mono text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTokenText(!showTokenText)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showTokenText ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Inicia con <code>APP_USR-</code> o <code>TEST-</code>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-public-key">
                Public Key (Opcional)
              </Label>
              <Input
                id="manual-public-key"
                type="text"
                placeholder="APP_USR-..."
                value={manualPublicKey}
                onChange={(e) => setManualPublicKey(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowManualModal(false)}
                disabled={savingManual}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingManual} className="gap-2">
                {savingManual ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    Validando y Guardando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    Validar y Guardar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmación de Desconexión */}
      <AlertDialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-5 w-5" />
              ¿Desconectar cuenta de Mercado Pago?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Al desconectar la cuenta, los nuevos pagos de suscripciones de clubes se pausarán o conmutarán al token definido en el archivo <code>.env</code> si existe. Puedes volver a conectarla en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? "Desconectando..." : "Sí, Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
