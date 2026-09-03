import React from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, XCircle, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type BookingStatusType =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rejected"
  | "failed"
  | string

interface BookingStatusBadgeProps {
  status: BookingStatusType
  className?: string
  showIcon?: boolean
  customLabel?: string
}

export function BookingStatusBadge({
  status,
  className,
  showIcon = true,
  customLabel,
}: BookingStatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim()

  switch (normalized) {
    case "confirmed":
    case "confirmada":
    case "paid":
    case "pagado":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-semibold text-xs border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-600",
            className
          )}
        >
          {showIcon && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          <span>{customLabel || "Confirmada"}</span>
        </Badge>
      )

    case "pending":
    case "pendiente":
    case "pendiente de pago":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-semibold text-xs border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-600",
            className
          )}
        >
          {showIcon && <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
          <span>{customLabel || "Pendiente"}</span>
        </Badge>
      )

    case "cancelled":
    case "cancelada":
    case "rejected":
    case "rechazado":
    case "failed":
    case "fallido":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-semibold text-xs border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 dark:bg-red-950/40 dark:border-red-600",
            className
          )}
        >
          {showIcon && <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />}
          <span>{customLabel || (normalized === "rejected" || normalized === "rechazado" ? "Rechazado" : "Cancelada")}</span>
        </Badge>
      )

    case "completed":
    case "completada":
    case "finalizada":
      return (
        <Badge
          variant="outline"
          className={cn(
            "flex items-center gap-1.5 font-semibold text-xs border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-600",
            className
          )}
        >
          {showIcon && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
          <span>{customLabel || "Completada"}</span>
        </Badge>
      )

    default:
      return (
        <Badge
          variant="secondary"
          className={cn("flex items-center gap-1.5 font-semibold text-xs", className)}
        >
          {showIcon && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          <span>{customLabel || status}</span>
        </Badge>
      )
  }
}
