"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import {
  CreditCardIcon, SmartphoneIcon, PercentIcon, CheckCircle2Icon,
  ExternalLinkIcon, SaveIcon, HelpCircleIcon, Loader2Icon,
  UploadCloudIcon, Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  getClubPaymentConfig, updateClubPaymentConfig, uploadClubQr, ClubPaymentConfig,
} from "@/lib/payments"
import api from "@/lib/axios"

// ─── Componente reutilizable de uploader de QR ───────────────────────────────

interface QrUploaderProps {
  walletType: "yape" | "plin"
  qrUrl: string
  isUploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
  accentColor: string
}

function QrUploader({
  walletType, qrUrl, isUploading, fileInputRef, onFileChange, onClear, accentColor,
}: QrUploaderProps) {
  const label = walletType === "yape" ? "Yape" : "Plin"
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">
        Código QR de {label} (Subir Imagen)
      </Label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full bg-white dark:bg-slate-950 border-dashed border-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs flex items-center justify-center gap-2 h-11"
      >
        {isUploading ? (
          <>
            <Loader2Icon className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
            <span>Subiendo imagen QR...</span>
          </>
        ) : (
          <>
            <UploadCloudIcon className="w-4 h-4" style={{ color: accentColor }} />
            <span>{qrUrl ? "Cambiar Imagen de QR" : "Subir Archivo de QR (PNG, JPG)"}</span>
          </>
        )}
      </Button>

      {qrUrl && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-950 rounded-xl border flex flex-col sm:flex-row items-center gap-4">
          <img
            src={qrUrl}
            alt={`QR ${label}`}
            className="w-24 h-24 object-contain border rounded-lg bg-white p-1"
          />
          <div className="space-y-1 text-center sm:text-left flex-1">
            <p className="text-xs font-semibold text-emerald-600 flex items-center justify-center sm:justify-start gap-1">
              <CheckCircle2Icon className="w-3.5 h-3.5" />
              Código QR de {label} cargado y listo
            </p>
            <p className="text-[11px] text-slate-500">
              Tus clientes verán este QR al reservar con {label}.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] h-7 px-2"
            >
              <Trash2Icon className="w-3 h-3 mr-1" />
              Quitar QR
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function PaymentSettingsTab() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const yapeRef = useRef<HTMLInputElement>(null)
  const plinRef = useRef<HTMLInputElement>(null)

  const clubId = session?.user?.clubId

  const [aceptaMercadopago, setAceptaMercadopago] = useState(false)
  const [yapeNumero, setYapeNumero] = useState("")
  const [yapeQrUrl, setYapeQrUrl] = useState("")
  const [plinNumero, setPlinNumero] = useState("")
  const [plinQrUrl, setPlinQrUrl] = useState("")
  const [porcentajeAdelantoDefault, setPorcentajeAdelantoDefault] = useState(50)
  const [adelantoMinimo, setAdelantoMinimo] = useState("")
  const [isMPConnected, setIsMPConnected] = useState(false)
  const [isUploadingYape, setIsUploadingYape] = useState(false)
  const [isUploadingPlin, setIsUploadingPlin] = useState(false)

  // Cargar configuración del club (usa /my si no hay clubId)
  const { data: config, isLoading } = useQuery({
    queryKey: ["club-payment-config", clubId],
    queryFn: () => getClubPaymentConfig(clubId),
  })

  // Verificar conexión de Mercado Pago
  useEffect(() => {
    if (!clubId) return
    api.get(`/clubs/${clubId}`).then((res) => {
      if (res.data?.mpAccessToken || res.data?.mpUserId) setIsMPConnected(true)
    }).catch(() => {})
  }, [clubId])

  // Sincronizar formulario con datos del servidor
  useEffect(() => {
    if (config) {
      setAceptaMercadopago(config.aceptaMercadopago ?? false)
      setYapeNumero(config.yapeNumero || "")
      setYapeQrUrl(config.yapeQrUrl || "")
      setPlinNumero(config.plinNumero || "")
      setPlinQrUrl((config as any).plinQrUrl || "")
      setPorcentajeAdelantoDefault(config.porcentajeAdelantoDefault ?? 50)
      setAdelantoMinimo(config.adelantoMinimo ? String(config.adelantoMinimo) : "")
    }
  }, [config])

  // Guardar configuración
  const mutation = useMutation({
    mutationFn: (data: any) => updateClubPaymentConfig(clubId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-payment-config", clubId] })
      toast.success("Configuración guardada", {
        description: "Los cambios aplican para nuevas reservas.",
      })
    },
    onError: (err: any) => {
      toast.error("Error al guardar", {
        description: err.response?.data?.message || err.message,
      })
    },
  })

  const handleSave = () => {
    mutation.mutate({
      aceptaMercadopago,
      yapeNumero: yapeNumero.trim() || null,
      yapeQrUrl: yapeQrUrl.trim() || null,
      plinNumero: plinNumero.trim() || null,
      plinQrUrl: plinQrUrl.trim() || null,
      porcentajeAdelantoDefault: Number(porcentajeAdelantoDefault),
      adelantoMinimo: adelantoMinimo ? Number(adelantoMinimo) : null,
    })
  }

  // Manejar subida de archivo QR
  const handleQrUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    walletType: "yape" | "plin"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido", { description: "Selecciona PNG, JPG o WEBP." })
      return
    }
    const setUploading = walletType === "yape" ? setIsUploadingYape : setIsUploadingPlin
    const ref = walletType === "yape" ? yapeRef : plinRef
    try {
      setUploading(true)
      const res = await uploadClubQr(file, walletType)
      if (walletType === "yape") setYapeQrUrl(res.url)
      else setPlinQrUrl(res.url)
      queryClient.invalidateQueries({ queryKey: ["club-payment-config", clubId] })
      toast.success(`QR de ${walletType === "yape" ? "Yape" : "Plin"} subido`, {
        description: "Imagen guardada en almacenamiento seguro.",
      })
    } catch (err: any) {
      toast.error("Error al subir QR", {
        description: err.response?.data?.message || err.message,
      })
    } finally {
      setUploading(false)
      if (ref.current) ref.current.value = ""
    }
  }

  const handleConnectMP = () => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
    window.location.href = clubId
      ? `${base}/payments/authorize?clubId=${clubId}`
      : `${base}/payments/authorize`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2Icon className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── 1. MERCADO PAGO ──────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
                <CreditCardIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Pasarela de Pago: Mercado Pago</CardTitle>
                <CardDescription>Permite cobros con tarjeta y confirmación automática sin esperas</CardDescription>
              </div>
            </div>
            <Badge
              variant={isMPConnected ? "default" : "outline"}
              className={isMPConnected
                ? "bg-emerald-600 text-white font-medium px-3 py-1"
                : "border-amber-400 text-amber-600 font-medium px-3 py-1"}
            >
              {isMPConnected ? "Cuenta Vinculada" : "No Vinculada"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-50 dark:bg-slate-900">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-mp" className="text-sm font-semibold cursor-pointer">
                Aceptar pagos por Mercado Pago en las reservas
              </Label>
              <p className="text-xs text-slate-500">
                Si está activo, los usuarios podrán elegir Mercado Pago como medio de pago en el checkout.
              </p>
            </div>
            <Switch id="toggle-mp" checked={aceptaMercadopago} onCheckedChange={setAceptaMercadopago} />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isMPConnected
                  ? "Tu cuenta de Mercado Pago está conectada y lista para recibir cobros."
                  : "Conecta tu cuenta de Mercado Pago para recaudar directamente a tu cuenta bancaria."}
              </p>
              <p className="text-xs text-slate-500">
                El dinero de cada reserva confirmada entra directamente a tu cuenta de Mercado Pago.
              </p>
            </div>
            <Button
              type="button"
              variant={isMPConnected ? "outline" : "default"}
              onClick={handleConnectMP}
              className={!isMPConnected ? "bg-[#009EE3] hover:bg-[#0082ba] text-white shrink-0" : "shrink-0"}
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              {isMPConnected ? "Reconectar Cuenta" : "Conectar Mercado Pago"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. BILLETERAS (YAPE & PLIN) ──────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600">
              <SmartphoneIcon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Billeteras Digitales y Pagos Manuales (Yape &amp; Plin)</CardTitle>
              <CardDescription>Configura los números y QR donde los clientes transferirán el adelanto o saldo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-0">

          {/* YAPE */}
          <div className="space-y-4 p-4 rounded-xl border bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#732282]" />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Configuración Yape</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yape-numero" className="text-xs font-semibold">Número de Celular para Yape</Label>
              <Input
                id="yape-numero"
                placeholder="Ej. 987654321"
                value={yapeNumero}
                onChange={(e) => setYapeNumero(e.target.value)}
                maxLength={15}
              />
              <p className="text-[11px] text-slate-500">Puedes cambiar este número cuando tu club lo requiera.</p>
            </div>
            <QrUploader
              walletType="yape"
              qrUrl={yapeQrUrl}
              isUploading={isUploadingYape}
              fileInputRef={yapeRef}
              onFileChange={(e) => handleQrUpload(e, "yape")}
              onClear={() => setYapeQrUrl("")}
              accentColor="#732282"
            />
          </div>

          {/* PLIN */}
          <div className="space-y-4 p-4 rounded-xl border bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#00D4B2]" />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Configuración Plin</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plin-numero" className="text-xs font-semibold">Número de Celular para Plin</Label>
              <Input
                id="plin-numero"
                placeholder="Ej. 987654321"
                value={plinNumero}
                onChange={(e) => setPlinNumero(e.target.value)}
                maxLength={15}
              />
              <p className="text-[11px] text-slate-500">Puedes cambiar este número cuando tu club lo requiera.</p>
            </div>
            <QrUploader
              walletType="plin"
              qrUrl={plinQrUrl}
              isUploading={isUploadingPlin}
              fileInputRef={plinRef}
              onFileChange={(e) => handleQrUpload(e, "plin")}
              onClear={() => setPlinQrUrl("")}
              accentColor="#00D4B2"
            />
            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HelpCircleIcon className="w-4 h-4 text-emerald-600" />
                ¿Cómo funciona para el usuario?
              </p>
              <p>
                Al reservar con <strong>Yape</strong> o <strong>Plin</strong>, el usuario verá tu número/QR, enviará el monto y subirá la captura de pantalla dentro de la app para que la valides en tu bandeja de pagos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. POLÍTICA DE ADELANTOS ─────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
              <PercentIcon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Política de Adelantos y Pagos Parciales</CardTitle>
              <CardDescription>Define el porcentaje mínimo obligatorio que los clientes deben adelantar para confirmar su turno</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Porcentaje Mínimo de Adelanto:</Label>
                <Badge className="bg-emerald-600 text-white font-bold text-sm px-2.5 py-0.5">
                  {porcentajeAdelantoDefault}%
                </Badge>
              </div>
              <Slider
                value={[porcentajeAdelantoDefault]}
                onValueChange={(val) => setPorcentajeAdelantoDefault(val[0])}
                min={0} max={100} step={5} className="py-2"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>0% (Opcional)</span>
                <span>50% (Recomendado)</span>
                <span>100% (Total)</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adelanto-minimo" className="text-sm font-semibold">
                Monto Mínimo de Adelanto en Soles (Opcional)
              </Label>
              <Input
                id="adelanto-minimo"
                type="number"
                placeholder="Ej. 30.00"
                value={adelantoMinimo}
                onChange={(e) => setAdelantoMinimo(e.target.value)}
                min={0}
              />
              <p className="text-xs text-slate-500">
                Si se especifica, el adelanto nunca podrá ser menor a este valor en soles.
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              📊 Simulación de Reserva con tu política actual:
            </p>
            <p className="text-slate-700 dark:text-slate-300 text-xs">
              Para una cancha de <strong>S/ 100.00</strong>, el cliente deberá transferir al menos{" "}
              <strong className="text-emerald-600 text-sm">
                S/ {Math.max(Number(adelantoMinimo) || 0, (100 * porcentajeAdelantoDefault) / 100).toFixed(2)}
              </strong>{" "}
              para que su reserva quede en estado <strong>ADELANTO PAGADO</strong>. El saldo restante de{" "}
              <strong>
                S/ {(100 - Math.max(Number(adelantoMinimo) || 0, (100 * porcentajeAdelantoDefault) / 100)).toFixed(2)}
              </strong>{" "}
              se cobrará al momento de ingresar a la cancha o por el panel.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-2 border-t">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {mutation.isPending
              ? <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
              : <SaveIcon className="w-4 h-4 mr-2" />}
            Guardar Configuración
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
