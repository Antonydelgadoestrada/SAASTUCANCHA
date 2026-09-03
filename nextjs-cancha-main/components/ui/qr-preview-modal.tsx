"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from "lucide-react"
import { downloadImage } from "@/lib/payments"
import { toast } from "sonner"

interface QrPreviewModalProps {
  open: boolean
  onClose: () => void
  qrUrl?: string | null
  walletType?: "yape" | "plin" | "generic"
  titular?: string | null
  phone?: string | null
  amount?: number | null
  title?: string
}

export function QrPreviewModal({
  open,
  onClose,
  qrUrl,
  walletType = "yape",
  titular,
  phone,
  amount,
  title,
}: QrPreviewModalProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const isYape = walletType === "yape"
  const isPlin = walletType === "plin"
  const walletLabel = isYape ? "Yape" : isPlin ? "Plin" : "Billetera Digital"

  const handleCopyPhone = () => {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopied(true)
    toast.success(`Número de ${walletLabel} copiado`)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!qrUrl) return
    try {
      setDownloading(true)
      const filename = `QR-${walletLabel}-${phone || "pago"}.png`
      await downloadImage(qrUrl, filename)
      toast.success("Imagen de código QR descargada exitosamente")
    } catch (e: any) {
      toast.error("No se pudo descargar la imagen", { description: e.message })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header con gradiente según la billetera */}
        <div
          className={`p-5 text-white bg-gradient-to-r ${
            isYape
              ? "from-purple-700 via-purple-600 to-indigo-700"
              : isPlin
              ? "from-teal-600 via-cyan-600 to-blue-600"
              : "from-emerald-700 via-emerald-600 to-teal-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCodeIcon className="w-6 h-6 text-white" />
              <DialogTitle className="text-lg font-bold text-white">
                {title || `Escanear QR de ${walletLabel}`}
              </DialogTitle>
            </div>
            {amount != null && amount > 0 && (
              <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold px-2.5 py-1">
                S/ {amount.toFixed(2)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-white/80 mt-1">
            Escanea directamente con la cámara de tu app {walletLabel} o descarga la imagen para pagar desde tu galería.
          </p>
        </div>

        {/* Contenido con QR ampliado y detalles */}
        <div className="p-6 space-y-4 text-center">
          {qrUrl ? (
            <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 p-3 bg-white rounded-2xl shadow-md border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <img
                src={qrUrl}
                alt={`Código QR ${walletLabel}`}
                className="w-full h-full object-contain select-none"
              />
            </div>
          ) : (
            <div className="w-64 h-64 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-4">
              <QrCodeIcon className="w-16 h-16 opacity-30 mb-2" />
              <p className="text-xs font-semibold">Sin imagen QR disponible</p>
              <p className="text-[11px]">Realiza la transferencia usando el número telefónico indicado abajo.</p>
            </div>
          )}

          {/* Información del Titular y Número */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-2">
            {titular && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  Titular:
                </span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {titular}
                </span>
              </div>
            )}
            {phone && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-500 flex items-center gap-1">
                  <SmartphoneIcon className="w-3.5 h-3.5 text-slate-600" />
                  Número {walletLabel}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                    {phone}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={handleCopyPhone}
                  >
                    {copied ? (
                      <CheckIcon className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <CopyIcon className="w-3 h-3" />
                    )}
                    <span className="ml-1">{copied ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer con acciones */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>

          {qrUrl && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              <DownloadIcon className="w-4 h-4" />
              {downloading ? "Descargando..." : "Descargar Imagen QR"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
