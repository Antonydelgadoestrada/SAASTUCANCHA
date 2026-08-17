"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

// Datos de ejemplo
const pendingRequests = [
  {
    id: 1,
    name: "Club Deportivo Central",
    email: "central@example.com",
    createdAt: new Date(2025, 5, 11),
  },
  {
    id: 2,
    name: "Club Deportivo Este",
    email: "este@example.com",
    createdAt: new Date(2025, 5, 12),
  },
  {
    id: 3,
    name: "Polideportivo Municipal",
    email: "municipal@example.com",
    createdAt: new Date(2025, 5, 13),
  },
  {
    id: 4,
    name: "Club Deportivo Oeste",
    email: "oeste@example.com",
    createdAt: new Date(2025, 5, 14),
  },
]

export function AdminPendingRequests() {
  const handleApprove = (id: number, name: string) => {
    toast.success(`Club "${name}" aprobado correctamente`)
  }

  const handleReject = (id: number, name: string) => {
    toast.error(`Club "${name}" rechazado`)
  }

  return (
    <div className="space-y-6">
      {pendingRequests.map((request) => (
        <div key={request.id} className="flex flex-col gap-2">
          <div className="flex items-center">
            <Avatar className="h-9 w-9">
              <AvatarFallback>
                {request.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1">
              <p className="text-sm font-medium leading-none">{request.name}</p>
              <p className="text-sm text-muted-foreground">{request.email}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              {format(request.createdAt, "d MMM yyyy", { locale: es })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleReject(request.id, request.name)}
            >
              <XIcon className="mr-1 h-4 w-4" />
              Rechazar
            </Button>
            <Button size="sm" onClick={() => handleApprove(request.id, request.name)}>
              <CheckIcon className="mr-1 h-4 w-4" />
              Aprobar
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
