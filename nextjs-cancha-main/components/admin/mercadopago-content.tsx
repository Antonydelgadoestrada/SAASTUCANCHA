"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  CreditCardIcon,
  XCircleIcon,
  AlertTriangleIcon,
  RefreshCwIcon,
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  EyeIcon,
  EyeOffIcon,
  WifiIcon,
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

  const isConnected = status?.isConnected ?? false

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
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              }
            >
              {isConnected ? "Conectado" : "No conectado"}
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
              {testingPing ? "Probando..." : "Probar Conexión"}
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
                        {status.environment === "production" ? "Producción" : status.environment === "sandbox" ? "Pruebas" : status.environment}
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
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <p className="mt-1 font-semibold text-xs text-foreground">
                    {isConnected ? "Conectado" : "No conectado"}
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
                      : "No disponible"}
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
              Al desconectar la cuenta, los nuevos pagos de suscripciones de clubes se pausarán. Puedes volver a conectarla en cualquier momento.
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
