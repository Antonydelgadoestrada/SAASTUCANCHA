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
  EyeIcon,
  FileTextIcon,
  ExternalLinkIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCwIcon,
} from "lucide-react"
import { downloadImage } from "@/lib/payments"
import { toast } from "sonner"

interface ReceiptLightboxModalProps {
  open: boolean
  onClose: () => void
  imageUrl?: string | null
  title?: string
  subtitle?: string
  badgeLabel?: string
}

export function ReceiptLightboxModal({
  open,
  onClose,
  imageUrl,
  title = "Comprobante de Pago",
  subtitle,
  badgeLabel,
}: ReceiptLightboxModalProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!imageUrl) return
    try {
      setDownloading(true)
      const filename = `comprobante-${Date.now()}.png`
      await downloadImage(imageUrl, filename)
      toast.success("Comprobante descargado exitosamente")
    } catch (e: any) {
      toast.error("No se pudo descargar el comprobante", { description: e.message })
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = () => {
    setZoom(1)
    setRotation(0)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleReset()
        onClose()
      }}
    >
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
        <DialogHeader className="p-4 bg-slate-900 text-white flex flex-row items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <FileTextIcon className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-base font-bold text-white">
                {title}
              </DialogTitle>
              {badgeLabel && (
                <Badge className="bg-emerald-600/80 text-white text-xs">
                  {badgeLabel}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
            )}
          </div>
        </DialogHeader>

        {/* Barra de herramientas para Zoom y Rotación */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b text-xs">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              <ZoomInIcon className="w-3.5 h-3.5 mr-1" />
              Zoom +
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              <ZoomOutIcon className="w-3.5 h-3.5 mr-1" />
              Zoom -
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCwIcon className="w-3.5 h-3.5 mr-1" />
              Girar
            </Button>
            {(zoom !== 1 || rotation !== 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-slate-500"
                onClick={handleReset}
              >
                Restablecer
              </Button>
            )}
          </div>

          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" /> Abrir pestaña
            </a>
          )}
        </div>

        {/* Área de Visualización */}
        <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[350px] max-h-[60vh] overflow-auto">
          {imageUrl ? (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={imageUrl}
                alt="Comprobante"
                className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          ) : (
            <div className="text-center text-slate-400 p-8">
              <FileTextIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No hay comprobante adjunto</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 bg-slate-50 dark:bg-slate-900 border-t flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>

          {imageUrl && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
            >
              <DownloadIcon className="w-4 h-4" />
              {downloading ? "Descargando..." : "Descargar Comprobante"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
