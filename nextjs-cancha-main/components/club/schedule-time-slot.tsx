"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckIcon, ClockIcon, LockIcon, Sparkles, XIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { statusEnum } from "./schedules-content"

type ScheduleTimeSlotProps = {
  // status: "available" | "occupied" | "blocked"
  status: statusEnum
  time: string
  date: Date
  disabled?: boolean
  onStatusChange?: (
    status: statusEnum,
    time: string,
    date: Date
  ) => void;
  compact?: boolean
}

export function ScheduleTimeSlot({ status, time, date, onStatusChange, compact = false, disabled = false }: ScheduleTimeSlotProps) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Sincronizar el estado local cuando cambia la prop status
  useEffect(() => {
    setCurrentStatus(status)
  }, [status])

  const statusColors = {
    available: "bg-green-500 hover:bg-green-600",
    occupied: "bg-red-500 hover:bg-red-600",
    blocked: "bg-gray-500 hover:bg-gray-600",
    "on-hold": "bg-yellow-400 hover:bg-yellow-500",
    event: "bg-purple-600 hover:bg-purple-700",
  }

  const statusIcons = {
    available: <CheckIcon className="h-4 w-4" />,
    occupied: <XIcon className="h-4 w-4" />,
    blocked: <LockIcon className="h-4 w-4" />,
    "on-hold": <ClockIcon className="h-4 w-4" />,
    event: <Sparkles className="h-4 w-4" />,
  }

  const statusLabels = {
    available: "Disponible",
    occupied: "Ocupado",
    blocked: "Bloqueado",
    "on-hold":"Pendiente",
    event: "Evento",
  }

  const handleStatusChange = (newStatus: statusEnum) => {
    setCurrentStatus(newStatus)
    setIsDialogOpen(false)
    onStatusChange?.(newStatus, time, date);
    toast.success(`Horario marcado como ${statusLabels[newStatus].toLowerCase()}`)
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        className={`h-10 w-full justify-center rounded-md p-0 text-white ${statusColors[currentStatus]}`}
        disabled={disabled}
        onClick={() => setIsDialogOpen(true)}
      >
        {time}
      </Button>
    )
  }

  const handleToggle = () => {
    if (disabled) return;
    if (currentStatus === 'occupied' || currentStatus === 'on-hold' || currentStatus === 'event') return;
    const newStatus: statusEnum = currentStatus === 'available' ? 'blocked' : 'available';
    handleStatusChange(newStatus);
  };

  const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es })
  const ariaDescription = `Horario ${time} del ${formattedDate}: ${statusLabels[currentStatus]}`

  return (
    <>
      <Button
        variant="ghost"
        className={`h-10 w-full justify-center rounded-md p-0 text-white ${statusColors[currentStatus]}`}
        disabled={disabled || (currentStatus == 'occupied' || currentStatus == 'on-hold' || currentStatus == 'event')}
        onClick={handleToggle}
        aria-label={ariaDescription}
        title={
          currentStatus === 'event'
            ? 'Evento (no editable)'
            : currentStatus === 'available'
              ? 'Click para bloquear'
              : 'Click para disponible'
        }
      >
        {statusIcons[currentStatus]}
        <span className="sr-only">{ariaDescription}</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar horario</DialogTitle>
            <DialogDescription>
              {format(date, "EEEE d 'de' MMMM", { locale: es })} - {time}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p>
              Estado actual: <span className="font-medium">{statusLabels[currentStatus]}</span>
            </p>
            <p>Selecciona el nuevo estado para este horario:</p>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => handleStatusChange("available" as statusEnum)} className="bg-green-500 hover:bg-green-600">
              <CheckIcon className="mr-2 h-4 w-4" />
              Disponible
            </Button>
            <Button onClick={() => handleStatusChange("occupied" as statusEnum)} className="bg-red-500 hover:bg-red-600">
              <XIcon className="mr-2 h-4 w-4" />
              Ocupado
            </Button>
            <Button onClick={() => handleStatusChange("blocked" as statusEnum)} className="bg-gray-500 hover:bg-gray-600">
              <LockIcon className="mr-2 h-4 w-4" />
              Bloqueado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
