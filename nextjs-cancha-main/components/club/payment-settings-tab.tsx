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
  UploadCloudIcon, Trash2Icon, MessageCircleIcon, PencilIcon,
  XIcon, PhoneIcon, QrCodeIcon, ShieldCheckIcon, CopyIcon,
  CheckIcon, SparklesIcon, DownloadIcon, Maximize2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  getClubPaymentConfig, updateClubPaymentConfig, uploadClubQr,
  ClubPaymentConfig, getWhatsAppLink, formatWhatsAppNumber,
  downloadImage,
} from "@/lib/payments"
import { QrPreviewModal } from "@/components/ui/qr-preview-modal"
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
  onOpenPreview?: () => void
}

function QrUploader({
  walletType, qrUrl, isUploading, fileInputRef, onFileChange, onClear, accentColor, onOpenPreview,
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
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-dashed border-2 h-12 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
        style={{ borderColor: `${accentColor}60` }}
      >
        {isUploading ? (
          <>
            <Loader2Icon className="w-4 h-4 animate-spin text-slate-500" />
            <span>Subiendo imagen QR...</span>
          </>
        ) : (
          <>
            <UploadCloudIcon className="w-4 h-4" style={{ color: accentColor }} />
            <span>{qrUrl ? `Cambiar Imagen de QR (${label})` : `Subir Archivo de QR (${label})`}</span>
          </>
        )}
      </Button>

      {qrUrl && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-950 rounded-xl border flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group shrink-0">
            <img
              src={qrUrl}
              alt={`QR ${label}`}
              className="w-24 h-24 object-contain border rounded-lg bg-white p-1 shadow-sm cursor-pointer hover:opacity-95"
              onClick={onOpenPreview}
              title="Hacer clic para ampliar QR"
            />
          </div>
          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <p className="text-xs font-semibold text-emerald-600 flex items-center justify-center sm:justify-start gap-1">
              <CheckCircle2Icon className="w-3.5 h-3.5" />
              Código QR de {label} cargado y listo
            </p>
            <p className="text-[11px] text-slate-500">
              Tus clientes verán este código QR en pantalla al seleccionar {label} en el proceso de reserva.
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {onOpenPreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenPreview}
                  className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Maximize2Icon className="w-3 h-3 mr-1" />
                  Ampliar QR
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadImage(qrUrl, `QR-${label}-club.png`)}
                className="text-xs h-7 px-2 text-slate-700 hover:text-slate-900"
              >
                <DownloadIcon className="w-3 h-3 mr-1" />
                Descargar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-[11px] h-7 px-2"
              >
                <Trash2Icon className="w-3 h-3 mr-1" />
                Quitar QR
              </Button>
            </div>
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

  // Estados de formulario
  const [aceptaMercadopago, setAceptaMercadopago] = useState(false)
  const [whatsapp, setWhatsapp] = useState("")
  const [yapeNumero, setYapeNumero] = useState("")
  const [yapeQrUrl, setYapeQrUrl] = useState("")
  const [yapeTitular, setYapeTitular] = useState("")
  const [plinNumero, setPlinNumero] = useState("")
  const [plinQrUrl, setPlinQrUrl] = useState("")
  const [plinTitular, setPlinTitular] = useState("")
  const [porcentajeAdelantoDefault, setPorcentajeAdelantoDefault] = useState(50)
  const [adelantoMinimo, setAdelantoMinimo] = useState("")
  const [isMPConnected, setIsMPConnected] = useState(false)

  // Estados de subida
  const [isUploadingYape, setIsUploadingYape] = useState(false)
  const [isUploadingPlin, setIsUploadingPlin] = useState(false)

  // Estados de Edición por Sección
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false)
  const [isEditingYape, setIsEditingYape] = useState(false)
  const [isEditingPlin, setIsEditingPlin] = useState(false)

  // Estado de guardado activo por sección (para spinners independientes)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrModalData, setQrModalData] = useState<{
    qrUrl?: string | null
    walletType?: "yape" | "plin"
    titular?: string | null
    phone?: string | null
    amount?: number | null
  }>({})

  // Cargar configuración del club
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

  // Notificaciones de retorno OAuth de Mercado Pago
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const mpStatus = params.get("mp_status")
    const mpError = params.get("mp_error")

    if (mpStatus === "connected") {
      setIsMPConnected(true)
      toast.success("¡Mercado Pago conectado exitosamente!", {
        description: "Tu cuenta ha sido vinculada para recibir los pagos de las reservas.",
      })
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (mpError) {
      if (mpError === "expired_or_used") {
        toast.error("El código de autorización expiró o ya fue utilizado", {
          description: "Por favor vuelve a presionar 'Conectar Mercado Pago' para autorizar de nuevo.",
        })
      } else {
        toast.error("No se pudo completar la conexión con Mercado Pago", {
          description: "Revisa la configuración o intenta de nuevo.",
        })
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Sincronizar formulario inicial cuando llega la configuración
  useEffect(() => {
    if (config) {
      setAceptaMercadopago(config.aceptaMercadopago ?? false)
      setWhatsapp(config.whatsapp || "")
      setYapeNumero(config.yapeNumero || "")
      setYapeQrUrl(config.yapeQrUrl || "")
      setYapeTitular(config.yapeTitular || "")
      setPlinNumero(config.plinNumero || "")
      setPlinQrUrl((config as any).plinQrUrl || "")
      setPlinTitular(config.plinTitular || "")
      setPorcentajeAdelantoDefault(config.porcentajeAdelantoDefault ?? 50)
      setAdelantoMinimo(config.adelantoMinimo ? String(config.adelantoMinimo) : "")

      // Si una sección no tiene datos guardados, dejarla en modo edición por defecto para facilitar el llenado
      if (!config.whatsapp) setIsEditingWhatsapp(true)
      if (!config.yapeNumero && !config.yapeQrUrl && !config.yapeTitular) setIsEditingYape(true)
      if (!config.plinNumero && !(config as any).plinQrUrl && !config.plinTitular) setIsEditingPlin(true)
    }
  }, [config])

  // Mutación para guardar configuraciones
  const mutation = useMutation({
    mutationFn: (data: Partial<ClubPaymentConfig>) => updateClubPaymentConfig(clubId, data),
    onSuccess: (savedData, variables) => {
      // Actualizar caché de React Query con los datos retornados
      queryClient.setQueryData(["club-payment-config", clubId], (old: any) => ({
        ...old,
        ...savedData,
      }))

      // Resetear estados de edición según qué se guardó
      if (savingSection === "whatsapp" || savingSection === "all") {
        setIsEditingWhatsapp(false)
      }
      if (savingSection === "yape" || savingSection === "wallets" || savingSection === "all") {
        setIsEditingYape(false)
      }
      if (savingSection === "plin" || savingSection === "wallets" || savingSection === "all") {
        setIsEditingPlin(false)
      }

      const sectionLabels: Record<string, string> = {
        whatsapp: "WhatsApp de atención guardado",
        mercadopago: "Configuración de Mercado Pago guardada",
        yape: "Configuración de Yape guardada",
        plin: "Configuración de Plin guardada",
        wallets: "Configuración de Billeteras guardada",
        policies: "Políticas de adelanto guardadas",
        all: "Toda la configuración guardada exitosamente",
      }

      toast.success(sectionLabels[savingSection || "all"] || "Configuración guardada", {
        description: "Los cambios se aplicaron correctamente para tus canchas y reservas.",
      })
      setSavingSection(null)
    },
    onError: (err: any) => {
      toast.error("Error al guardar configuración", {
        description: err.response?.data?.message || err.message,
      })
      setSavingSection(null)
    },
  })

  // ─── Guardados por sección ──────────────────────────────────────────────────

  const handleSaveSection = (section: string, payload: Partial<ClubPaymentConfig>) => {
    setSavingSection(section)
    mutation.mutate(payload)
  }

  const handleSaveWhatsApp = () => {
    handleSaveSection("whatsapp", {
      whatsapp: whatsapp.trim() || null,
    })
  }

  const handleSaveMercadoPago = (nuevoEstadoMP?: boolean) => {
    const estado = typeof nuevoEstadoMP === "boolean" ? nuevoEstadoMP : aceptaMercadopago
    handleSaveSection("mercadopago", {
      aceptaMercadopago: estado,
    })
  }

  const handleSaveYape = () => {
    handleSaveSection("yape", {
      yapeNumero: yapeNumero.trim() || null,
      yapeQrUrl: yapeQrUrl.trim() || null,
      yapeTitular: yapeTitular.trim() || null,
    })
  }

  const handleSavePlin = () => {
    handleSaveSection("plin", {
      plinNumero: plinNumero.trim() || null,
      plinQrUrl: plinQrUrl.trim() || null,
      plinTitular: plinTitular.trim() || null,
    })
  }

  const handleSaveBothWallets = () => {
    handleSaveSection("wallets", {
      yapeNumero: yapeNumero.trim() || null,
      yapeQrUrl: yapeQrUrl.trim() || null,
      yapeTitular: yapeTitular.trim() || null,
      plinNumero: plinNumero.trim() || null,
      plinQrUrl: plinQrUrl.trim() || null,
      plinTitular: plinTitular.trim() || null,
    })
  }

  const handleSavePolicies = () => {
    handleSaveSection("policies", {
      porcentajeAdelantoDefault: Number(porcentajeAdelantoDefault),
      adelantoMinimo: adelantoMinimo ? Number(adelantoMinimo) : null,
    })
  }

  const handleSaveAll = () => {
    handleSaveSection("all", {
      aceptaMercadopago,
      whatsapp: whatsapp.trim() || null,
      yapeNumero: yapeNumero.trim() || null,
      yapeQrUrl: yapeQrUrl.trim() || null,
      yapeTitular: yapeTitular.trim() || null,
      plinNumero: plinNumero.trim() || null,
      plinQrUrl: plinQrUrl.trim() || null,
      plinTitular: plinTitular.trim() || null,
      porcentajeAdelantoDefault: Number(porcentajeAdelantoDefault),
      adelantoMinimo: adelantoMinimo ? Number(adelantoMinimo) : null,
    })
  }

  // ─── Cancelar Edición por sección ──────────────────────────────────────────

  const handleCancelWhatsApp = () => {
    setWhatsapp(config?.whatsapp || "")
    setIsEditingWhatsapp(false)
  }

  const handleCancelYape = () => {
    setYapeNumero(config?.yapeNumero || "")
    setYapeQrUrl(config?.yapeQrUrl || "")
    setYapeTitular(config?.yapeTitular || "")
    setIsEditingYape(false)
  }

  const handleCancelPlin = () => {
    setPlinNumero(config?.plinNumero || "")
    setPlinQrUrl((config as any)?.plinQrUrl || "")
    setPlinTitular(config?.plinTitular || "")
    setIsEditingPlin(false)
  }

  // ─── Subida de archivo QR ───────────────────────────────────────────────────

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
      if (walletType === "yape") {
        setYapeQrUrl(res.url)
      } else {
        setPlinQrUrl(res.url)
      }
      // Actualizar caché de forma limpia sin invalidar agresivamente
      queryClient.setQueryData(["club-payment-config", clubId], (old: any) => ({
        ...old,
        [walletType === "yape" ? "yapeQrUrl" : "plinQrUrl"]: res.url,
      }))
      toast.success(`Código QR de ${walletType === "yape" ? "Yape" : "Plin"} subido con éxito`, {
        description: "Imagen almacenada de forma segura. Recuerda pulsar Guardar para confirmar tus datos.",
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

  const handleConnectMP = async () => {
    try {
      const endpoint = clubId ? `/payments/authorize?clubId=${clubId}` : `/payments/authorize`
      const res = await api.get(endpoint)
      const targetUrl = typeof res.data === "string" ? res.data : res.data?.url
      if (targetUrl) {
        window.location.href = targetUrl
        return
      }
    } catch {
      // Fallback a navegación directa
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"
    window.location.href = clubId
      ? `${base}/payments/authorize?clubId=${clubId}`
      : `${base}/payments/authorize`
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success("Copiado al portapapeles")
    setTimeout(() => setCopiedField(null), 2000)
  }

  const hasYapeConfigured = Boolean(yapeNumero || yapeQrUrl || yapeTitular)
  const hasPlinConfigured = Boolean(plinNumero || plinQrUrl || plinTitular)
  const hasConfiguredWallets = hasYapeConfigured || hasPlinConfigured
  const testWhatsAppUrl = whatsapp ? getWhatsAppLink(whatsapp, "Hola! Este es un mensaje de prueba para TuCancha.") : ""

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2Icon className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-500">Cargando configuración de cobros y billeteras...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-10">

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── 1. SECCIÓN: WHATSAPP Y COMUNICACIÓN DIRECTA ───────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-500 overflow-hidden">
        <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
                <MessageCircleIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold">WhatsApp del Club y Comunicación Directa</CardTitle>
                </div>
                <CardDescription>
                  Los clientes podrán contactarte directamente con 1 clic desde la búsqueda, detalles y proceso de reserva
                </CardDescription>
              </div>
            </div>

            {/* Acciones de Cabecera: Estado & Botón Editar */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={whatsapp ? "default" : "outline"}
                className={whatsapp
                  ? "bg-emerald-600 text-white font-medium px-3 py-1 gap-1"
                  : "border-slate-300 text-slate-500 font-medium px-3 py-1"}
              >
                {whatsapp ? (
                  <>
                    <CheckCircle2Icon className="w-3.5 h-3.5" />
                    WhatsApp Activo
                  </>
                ) : "No Configurado"}
              </Badge>

              {!isEditingWhatsapp && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingWhatsapp(true)}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5 h-8"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  Editar WhatsApp
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {!isEditingWhatsapp && whatsapp ? (
            /* Vista de Resumen / Modo Lectura */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-3">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Número de Contacto Oficial</p>
                <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <PhoneIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">{whatsapp}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(whatsapp, "whatsapp")}
                    className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800"
                  >
                    {copiedField === "whatsapp" ? <CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Formato internacional para enlace: <strong className="text-emerald-700 font-mono">+{formatWhatsAppNumber(whatsapp)}</strong>
                </p>
              </div>

              <div className="flex flex-col justify-between p-4 rounded-xl border bg-slate-50 dark:bg-slate-900/60 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                    Prueba del Botón de Contacto
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Verifica cómo los clientes abrirán la conversación en WhatsApp Web o en su teléfono.
                  </p>
                </div>
                <a
                  href={testWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-2 h-9"
                  >
                    <MessageCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Probar Enlace de WhatsApp
                    <ExternalLinkIcon className="w-3 h-3 ml-auto opacity-70" />
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            /* Modo Edición */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-slate-50 dark:bg-slate-900">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-input" className="text-xs font-semibold flex items-center gap-1.5">
                    <PhoneIcon className="w-3.5 h-3.5 text-emerald-600" />
                    Número de Celular para WhatsApp
                  </Label>
                  <div className="relative">
                    <Input
                      id="whatsapp-input"
                      placeholder="Ej. 987654321 o +51 987654321"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      maxLength={20}
                      className="bg-white dark:bg-slate-950 font-medium text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ingresa el número con o sin prefijo de país (+51). Los usuarios abrirán el chat automáticamente.
                  </p>
                </div>

                <div className="flex flex-col justify-between p-3.5 bg-white dark:bg-slate-950 rounded-lg border border-emerald-100 dark:border-emerald-950 space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
                      Prueba de Enlace en Vivo
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {whatsapp
                        ? `Número formateado: ${formatWhatsAppNumber(whatsapp)}`
                        : "Ingresa tu número para generar el enlace de prueba."}
                    </p>
                  </div>

                  {whatsapp ? (
                    <a
                      href={testWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-2 h-9"
                      >
                        <MessageCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                        Probar Enlace de WhatsApp
                        <ExternalLinkIcon className="w-3 h-3 ml-auto opacity-70" />
                      </Button>
                    </a>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full text-xs opacity-50 h-9"
                    >
                      Probar Enlace de WhatsApp
                    </Button>
                  )}
                </div>
              </div>

              {/* Botones de Acción de la Sección WhatsApp */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {config?.whatsapp && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelWhatsApp}
                    disabled={savingSection === "whatsapp"}
                    className="text-xs text-slate-500 hover:text-slate-700 h-9"
                  >
                    <XIcon className="w-3.5 h-3.5 mr-1" />
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveWhatsApp}
                  disabled={savingSection === "whatsapp"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 px-4 shadow-sm"
                >
                  {savingSection === "whatsapp" ? (
                    <>
                      <Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Guardando WhatsApp...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
                      Guardar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── 2. SECCIÓN: PASARELA DE PAGO: MERCADO PAGO ────────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
        <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600">
                <CreditCardIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Pasarela de Pago: Mercado Pago</CardTitle>
                <CardDescription>Permite cobros con tarjeta de crédito/débito y confirmación automática sin esperas</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={isMPConnected ? "default" : "outline"}
                className={isMPConnected
                  ? "bg-blue-600 text-white font-medium px-3 py-1 gap-1"
                  : "border-amber-400 text-amber-600 font-medium px-3 py-1"}
              >
                {isMPConnected ? (
                  <>
                    <CheckCircle2Icon className="w-3.5 h-3.5" />
                    Cuenta Vinculada
                  </>
                ) : "No Vinculada"}
              </Badge>

              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveMercadoPago()}
                disabled={savingSection === "mercadopago"}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8 px-3 shadow-sm"
              >
                {savingSection === "mercadopago" ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <SaveIcon className="w-3.5 h-3.5 mr-1" />
                    Guardar MP
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-50 dark:bg-slate-900">
            <div className="space-y-0.5">
              <Label htmlFor="toggle-mp" className="text-sm font-semibold cursor-pointer">
                Aceptar pagos por Mercado Pago en las reservas
              </Label>
              <p className="text-xs text-slate-500">
                Si está activo, los usuarios podrán elegir Mercado Pago como medio de pago online en el checkout.
              </p>
            </div>
            <Switch
              id="toggle-mp"
              checked={aceptaMercadopago}
              onCheckedChange={(checked) => {
                setAceptaMercadopago(checked)
              }}
            />
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
              className={!isMPConnected ? "bg-[#009EE3] hover:bg-[#0082ba] text-white shrink-0 text-xs font-semibold h-9" : "shrink-0 text-xs font-semibold h-9"}
            >
              <ExternalLinkIcon className="w-4 h-4 mr-2" />
              {isMPConnected ? "Reconectar Cuenta" : "Conectar Mercado Pago"}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── 3. SECCIÓN: BILLETERAS DIGITALES (YAPE & PLIN) ────────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-purple-500 overflow-hidden">
        <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600">
                <SmartphoneIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Billeteras Digitales y Pagos Manuales (Yape &amp; Plin)</CardTitle>
                <CardDescription>Configura los números y códigos QR donde los clientes transferirán el adelanto o saldo</CardDescription>
              </div>
            </div>

            {/* Acciones Generales de Billeteras */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={hasConfiguredWallets ? "default" : "outline"}
                className={hasConfiguredWallets
                  ? "bg-purple-600 text-white font-medium px-3 py-1 gap-1"
                  : "border-amber-400 text-amber-600 font-medium px-3 py-1"}
              >
                {hasConfiguredWallets ? (
                  <>
                    <CheckCircle2Icon className="w-3.5 h-3.5" />
                    Billeteras Configuradas
                  </>
                ) : "Pendiente"}
              </Badge>

              <Button
                type="button"
                size="sm"
                onClick={handleSaveBothWallets}
                disabled={savingSection === "wallets" || savingSection === "yape" || savingSection === "plin"}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold h-8 px-3 shadow-sm"
              >
                {savingSection === "wallets" ? (
                  <>
                    <Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
                    Guardar Billeteras
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── SUB-TARJETA: CONFIGURACIÓN YAPE ────────────────────────────── */}
            <div className="rounded-xl border border-purple-200/70 dark:border-purple-900/50 bg-white dark:bg-slate-900/80 p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                {/* Cabecera Yape */}
                <div className="flex items-center justify-between pb-3 border-b border-purple-100 dark:border-purple-950">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#732282] shrink-0" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Configuración Yape</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={hasYapeConfigured
                        ? "bg-purple-50 text-[#732282] border-purple-200 text-[11px] font-semibold"
                        : "bg-slate-50 text-slate-500 border-slate-200 text-[11px]"}
                    >
                      {hasYapeConfigured ? "Activo" : "Sin Configurar"}
                    </Badge>

                    {!isEditingYape && hasYapeConfigured && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingYape(true)}
                        className="text-xs font-semibold text-[#732282] border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1 h-7 px-2"
                      >
                        <PencilIcon className="w-3 h-3" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Contenido Yape */}
                {!isEditingYape && hasYapeConfigured ? (
                  /* Modo Lectura Yape */
                  <div className="space-y-4 pt-4">
                    <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/40 space-y-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-slate-500 font-medium">Nombre del Titular de la cuenta:</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {yapeTitular || <span className="text-slate-400 italic text-xs font-normal">No especificado</span>}
                        </p>
                      </div>

                      <div className="border-t border-purple-100 dark:border-purple-900/40 pt-2 space-y-0.5">
                        <p className="text-[11px] text-slate-500 font-medium">Número para transferencias Yape:</p>
                        <div className="flex items-center justify-between">
                          <p className="text-base font-bold text-[#732282] dark:text-purple-300 font-mono">
                            {yapeNumero || <span className="text-slate-400 italic text-xs font-normal">No especificado</span>}
                          </p>
                          {yapeNumero && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(yapeNumero, "yape")}
                              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
                            >
                              {copiedField === "yape" ? <CheckIcon className="w-3 h-3 text-purple-600" /> : <CopyIcon className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {yapeQrUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-purple-100 dark:border-purple-950">
                        <div className="relative group shrink-0">
                          <img
                            src={yapeQrUrl}
                            alt="QR Yape"
                            className="w-20 h-20 object-contain border rounded-lg bg-white p-1 shadow-sm cursor-pointer hover:opacity-95"
                            onClick={() => {
                              setQrModalData({
                                qrUrl: yapeQrUrl,
                                walletType: "yape",
                                titular: yapeTitular,
                                phone: yapeNumero,
                              })
                              setQrModalOpen(true)
                            }}
                            title="Hacer clic para ampliar QR"
                          />
                        </div>
                        <div className="text-xs space-y-1.5 flex-1">
                          <p className="font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2Icon className="w-3.5 h-3.5" /> QR de Yape Activo
                          </p>
                          <p className="text-slate-500 text-[11px]">Los usuarios pueden escanearlo desde la app.</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setQrModalData({
                                  qrUrl: yapeQrUrl,
                                  walletType: "yape",
                                  titular: yapeTitular,
                                  phone: yapeNumero,
                                })
                                setQrModalOpen(true)
                              }}
                              className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Maximize2Icon className="w-3 h-3 mr-1" />
                              Ampliar QR
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => downloadImage(yapeQrUrl, `QR-Yape-${yapeNumero || "club"}.png`)}
                              className="text-xs h-7 px-2 text-slate-700 hover:text-slate-900"
                            >
                              <DownloadIcon className="w-3 h-3 mr-1" />
                              Descargar
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              onClick={() => setIsEditingYape(true)}
                              className="text-[#732282] text-xs p-0 h-auto font-semibold"
                            >
                              Cambiar imagen
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border text-center text-xs text-slate-400">
                        <QrCodeIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        Sin imagen QR cargada para Yape
                      </div>
                    )}
                  </div>
                ) : (
                  /* Modo Edición Yape */
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="yape-titular" className="text-xs font-semibold">
                        Nombre del Titular de la Cuenta (Yape) *
                      </Label>
                      <Input
                        id="yape-titular"
                        placeholder="Ej. Juan Carlos Pérez o Club Deportivo TuCancha SAC"
                        value={yapeTitular}
                        onChange={(e) => setYapeTitular(e.target.value)}
                        maxLength={80}
                        className="bg-white dark:bg-slate-950 text-sm"
                      />
                      <p className="text-[11px] text-slate-500">
                        Los clientes verán este nombre antes de pagar para confirmar que transfieren a la persona/empresa correcta.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="yape-numero" className="text-xs font-semibold">Número de Celular para Yape *</Label>
                      <Input
                        id="yape-numero"
                        placeholder="Ej. 987654321"
                        value={yapeNumero}
                        onChange={(e) => setYapeNumero(e.target.value)}
                        maxLength={15}
                        className="bg-white dark:bg-slate-950 font-mono text-sm"
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
                      onOpenPreview={() => {
                        setQrModalData({
                          qrUrl: yapeQrUrl,
                          walletType: "yape",
                          titular: yapeTitular,
                          phone: yapeNumero,
                        })
                        setQrModalOpen(true)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Botón Guardar / Cancelar Yape */}
              {isEditingYape && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  {(config?.yapeNumero || config?.yapeTitular) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelYape}
                      disabled={savingSection === "yape"}
                      className="text-xs text-slate-500 hover:text-slate-700 h-8"
                    >
                      <XIcon className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveYape}
                    disabled={savingSection === "yape"}
                    className="bg-[#732282] hover:bg-[#5a1966] text-white text-xs font-semibold h-8 px-3 shadow-sm"
                  >
                    {savingSection === "yape" ? (
                      <>
                        <Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Guardando Yape...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
                        Guardar Yape
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>


            {/* ── SUB-TARJETA: CONFIGURACIÓN PLIN ────────────────────────────── */}
            <div className="rounded-xl border border-teal-200/70 dark:border-teal-900/50 bg-white dark:bg-slate-900/80 p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                {/* Cabecera Plin */}
                <div className="flex items-center justify-between pb-3 border-b border-teal-100 dark:border-teal-950">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#00D4B2] shrink-0" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">Configuración Plin</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={hasPlinConfigured
                        ? "bg-teal-50 text-teal-700 border-teal-200 text-[11px] font-semibold"
                        : "bg-slate-50 text-slate-500 border-slate-200 text-[11px]"}
                    >
                      {hasPlinConfigured ? "Activo" : "Sin Configurar"}
                    </Badge>

                    {!isEditingPlin && hasPlinConfigured && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPlin(true)}
                        className="text-xs font-semibold text-teal-700 border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1 h-7 px-2"
                      >
                        <PencilIcon className="w-3 h-3" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Contenido Plin */}
                {!isEditingPlin && hasPlinConfigured ? (
                  /* Modo Lectura Plin */
                  <div className="space-y-4 pt-4">
                    <div className="bg-teal-50/50 dark:bg-teal-950/20 p-3.5 rounded-xl border border-teal-100 dark:border-teal-900/40 space-y-2.5">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-slate-500 font-medium">Nombre del Titular de la cuenta:</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {plinTitular || <span className="text-slate-400 italic text-xs font-normal">No especificado</span>}
                        </p>
                      </div>

                      <div className="border-t border-teal-100 dark:border-teal-900/40 pt-2 space-y-0.5">
                        <p className="text-[11px] text-slate-500 font-medium">Número para transferencias Plin:</p>
                        <div className="flex items-center justify-between">
                          <p className="text-base font-bold text-teal-700 dark:text-teal-300 font-mono">
                            {plinNumero || <span className="text-slate-400 italic text-xs font-normal">No especificado</span>}
                          </p>
                          {plinNumero && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(plinNumero, "plin")}
                              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
                            >
                              {copiedField === "plin" ? <CheckIcon className="w-3 h-3 text-teal-600" /> : <CopyIcon className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {plinQrUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-slate-950 p-3.5 rounded-xl border border-teal-100 dark:border-teal-950">
                        <div className="relative group shrink-0">
                          <img
                            src={plinQrUrl}
                            alt="QR Plin"
                            className="w-20 h-20 object-contain border rounded-lg bg-white p-1 shadow-sm cursor-pointer hover:opacity-95"
                            onClick={() => {
                              setQrModalData({
                                qrUrl: plinQrUrl,
                                walletType: "plin",
                                titular: plinTitular,
                                phone: plinNumero,
                              })
                              setQrModalOpen(true)
                            }}
                            title="Hacer clic para ampliar QR"
                          />
                        </div>
                        <div className="text-xs space-y-1.5 flex-1">
                          <p className="font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2Icon className="w-3.5 h-3.5" /> QR de Plin Activo
                          </p>
                          <p className="text-slate-500 text-[11px]">Los usuarios pueden escanearlo desde la app.</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setQrModalData({
                                  qrUrl: plinQrUrl,
                                  walletType: "plin",
                                  titular: plinTitular,
                                  phone: plinNumero,
                                })
                                setQrModalOpen(true)
                              }}
                              className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Maximize2Icon className="w-3 h-3 mr-1" />
                              Ampliar QR
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => downloadImage(plinQrUrl, `QR-Plin-${plinNumero || "club"}.png`)}
                              className="text-xs h-7 px-2 text-slate-700 hover:text-slate-900"
                            >
                              <DownloadIcon className="w-3 h-3 mr-1" />
                              Descargar
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              onClick={() => setIsEditingPlin(true)}
                              className="text-teal-700 text-xs p-0 h-auto font-semibold"
                            >
                              Cambiar imagen
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border text-center text-xs text-slate-400">
                        <QrCodeIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        Sin imagen QR cargada para Plin
                      </div>
                    )}
                  </div>
                ) : (
                  /* Modo Edición Plin */
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="plin-titular" className="text-xs font-semibold">
                        Nombre del Titular de la Cuenta (Plin) *
                      </Label>
                      <Input
                        id="plin-titular"
                        placeholder="Ej. Juan Carlos Pérez o Club Deportivo TuCancha SAC"
                        value={plinTitular}
                        onChange={(e) => setPlinTitular(e.target.value)}
                        maxLength={80}
                        className="bg-white dark:bg-slate-950 text-sm"
                      />
                      <p className="text-[11px] text-slate-500">
                        Los clientes verán este nombre antes de pagar para confirmar que transfieren a la persona/empresa correcta.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="plin-numero" className="text-xs font-semibold">Número de Celular para Plin *</Label>
                      <Input
                        id="plin-numero"
                        placeholder="Ej. 987654321"
                        value={plinNumero}
                        onChange={(e) => setPlinNumero(e.target.value)}
                        maxLength={15}
                        className="bg-white dark:bg-slate-950 font-mono text-sm"
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
                      onOpenPreview={() => {
                        setQrModalData({
                          qrUrl: plinQrUrl,
                          walletType: "plin",
                          titular: plinTitular,
                          phone: plinNumero,
                        })
                        setQrModalOpen(true)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Botón Guardar / Cancelar Plin */}
              {isEditingPlin && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  {(config?.plinNumero || (config as any)?.plinTitular) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelPlin}
                      disabled={savingSection === "plin"}
                      className="text-xs text-slate-500 hover:text-slate-700 h-8"
                    >
                      <XIcon className="w-3.5 h-3.5 mr-1" />
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePlin}
                    disabled={savingSection === "plin"}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold h-8 px-3 shadow-sm"
                  >
                    {savingSection === "plin" ? (
                      <>
                        <Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Guardando Plin...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
                        Guardar Plin
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

          </div>

          {/* Información explicativa para el dueño */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HelpCircleIcon className="w-4 h-4 text-purple-600" />
              ¿Cómo funciona el flujo de pago con Yape y Plin para el usuario?
            </p>
            <p>
              Al reservar con <strong>Yape</strong> o <strong>Plin</strong>, el usuario verá tu número y código QR, enviará el monto indicado y subirá la captura de pantalla dentro de la app para que la audites y confirmes en tu bandeja de pagos.
            </p>
          </div>
        </CardContent>
      </Card>


      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── 4. SECCIÓN: POLÍTICA DE ADELANTOS Y PAGOS PARCIALES ───────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm border-l-4 border-l-emerald-600 overflow-hidden">
        <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
                <PercentIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Política de Adelantos y Pagos Parciales</CardTitle>
                <CardDescription>Define el porcentaje mínimo obligatorio que los clientes deben adelantar para confirmar su turno</CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-emerald-600 text-white font-bold text-xs px-3 py-1">
                {porcentajeAdelantoDefault}% Adelanto
              </Badge>

              <Button
                type="button"
                size="sm"
                onClick={handleSavePolicies}
                disabled={savingSection === "policies"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8 px-3 shadow-sm"
              >
                {savingSection === "policies" ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <SaveIcon className="w-3.5 h-3.5 mr-1" />
                    Guardar Política
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
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
                className="font-mono text-sm"
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
            <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
              Para una cancha de <strong>S/ 100.00</strong>, el cliente deberá transferir al menos{" "}
              <strong className="text-emerald-600 text-sm">
                S/ {Math.max(Number(adelantoMinimo) || 0, (100 * porcentajeAdelantoDefault) / 100).toFixed(2)}
              </strong>{" "}
              para que su reserva quede en estado <strong>ADELANTO PAGADO</strong>. El saldo restante de{" "}
              <strong>
                S/ {(100 - Math.max(Number(adelantoMinimo) || 0, (100 * porcentajeAdelantoDefault) / 100)).toFixed(2)}
              </strong>{" "}
              se cobrará al momento de ingresar a la cancha o por el panel de administración.
            </p>
          </div>
        </CardContent>
      </Card>


      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* ── 5. BARRA GLOBAL: GUARDAR TODA LA CONFIGURACIÓN ──────────────────── */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-20">
        <Card className="border-2 border-emerald-500 bg-slate-900 text-white shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm sm:text-base text-white">Guardado General de Medios de Pago</p>
                <p className="text-xs text-slate-300">
                  Aplica y confirma todos los cambios de WhatsApp, Mercado Pago, Yape, Plin y Políticas a la vez.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={mutation.isPending}
              size="lg"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm h-11 px-6 shadow-lg transition-all transform hover:scale-[1.02]"
            >
              {mutation.isPending && savingSection === "all" ? (
                <>
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Guardando Toda la Configuración...
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4 mr-2" />
                  Guardar Toda la Configuración
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      <QrPreviewModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qrUrl={qrModalData.qrUrl}
        walletType={qrModalData.walletType}
        titular={qrModalData.titular}
        phone={qrModalData.phone}
      />

    </div>
  )
}
