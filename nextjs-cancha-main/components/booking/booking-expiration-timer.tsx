"use client"

import React, { useEffect, useState } from "react"
import { Clock, AlertTriangle, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface BookingExpirationTimerProps {
  createdAt?: string | Date
  paymentMethod?: string
  className?: string
  compact?: boolean
  onExpire?: () => void
}

export function BookingExpirationTimer({
  createdAt,
  paymentMethod,
  className,
  compact = false,
  onExpire,
}: BookingExpirationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    totalSeconds: number
    isExpired: boolean
    formattedText: string
  } | null>(null)

  const isWhatsApp =
    paymentMethod?.toLowerCase() === "whatsapp" ||
    paymentMethod?.toLowerCase() === "solo whatsapp"

  // 120 minutos para WhatsApp, 15 minutos para método regular
  const limitMinutes = isWhatsApp ? 120 : 15

  useEffect(() => {
    if (!createdAt) return

    const createdTime = new Date(createdAt).getTime()
    if (isNaN(createdTime)) return

    const expiryTime = createdTime + limitMinutes * 60 * 1000

    const updateTimer = () => {
      const now = Date.now()
      const diffMs = expiryTime - now
      const diffSec = Math.floor(diffMs / 1000)

      if (diffSec <= 0) {
        setTimeLeft({
          totalSeconds: 0,
          isExpired: true,
          formattedText: "Tiempo agotado",
        })
        if (onExpire) onExpire()
        return
      }

      const hours = Math.floor(diffSec / 3600)
      const minutes = Math.floor((diffSec % 3600) / 60)
      const seconds = diffSec % 60

      let formatted = ""
      if (hours > 0) {
        formatted = `${hours}h ${minutes}m ${seconds.toString().padStart(2, "0")}s`
      } else {
        formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} min`
      }

      setTimeLeft({
        totalSeconds: diffSec,
        isExpired: false,
        formattedText: formatted,
      })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [createdAt, limitMinutes, onExpire])

  if (!timeLeft) return null

  const isUrgent = !timeLeft.isExpired && timeLeft.totalSeconds <= 180 // menos de 3 minutos

  if (compact) {
    if (timeLeft.isExpired) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20",
            className
          )}
          title="El tiempo límite para adjuntar comprobante ha vencido y la cancha se liberará pronto."
        >
          <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
          <span>Tiempo agotado</span>
        </span>
      )
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors",
          isUrgent
            ? "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30 animate-pulse"
            : "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20",
          className
        )}
        title={`Tiempo restante antes de que expire la reserva (${limitMinutes} min límite)`}
      >
        {isUrgent ? (
          <Flame className="h-3 w-3 shrink-0 text-red-500 animate-bounce" />
        ) : (
          <Clock className="h-3 w-3 shrink-0 text-amber-600" />
        )}
        <span>Expira en: {timeLeft.formattedText}</span>
      </span>
    )
  }

  // Vista expandida (para tarjetas y bloques de información)
  if (timeLeft.isExpired) {
    return (
      <div
        className={cn(
          "p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-800 dark:text-red-300 flex items-center justify-between font-medium",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>
            <strong>Tiempo de espera agotado:</strong> La cancha está por ser liberada automáticamente.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "p-2.5 rounded-lg border text-xs flex items-center justify-between font-medium transition-all",
        isUrgent
          ? "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300 animate-pulse"
          : "bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {isUrgent ? (
          <Flame className="h-4 w-4 text-red-600 shrink-0 animate-bounce" />
        ) : (
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        <span>
          {isWhatsApp ? "Tiempo de coordinación:" : "Tiempo para adjuntar comprobante:"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "font-mono font-bold text-xs px-2 py-0.5 rounded shadow-sm",
            isUrgent
              ? "bg-red-600 text-white"
              : "bg-amber-600 text-white dark:bg-amber-500"
          )}
        >
          {timeLeft.formattedText}
        </span>
      </div>
    </div>
  )
}
