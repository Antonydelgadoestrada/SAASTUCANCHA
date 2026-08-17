"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckIcon, XIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { approveClub, rejectClub } from "@/lib/club"

interface PendingRequestsProps {
  requests: any[]
}

export function AdminPendingRequests({ requests: initialRequests }: PendingRequestsProps) {
  const [requests, setRequests] = useState<any[]>(initialRequests)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleApprove = async (id: string, name: string) => {
    setLoadingId(id)
    try {
      await approveClub(id)
      setRequests(requests.filter((r) => r.id !== id))
      toast.success(`Club "${name}" aprobado correctamente`)
    } catch (error) {
      toast.error("Error al aprobar el club")
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (id: string, name: string) => {
    setLoadingId(id)
    try {
      await rejectClub(id)
      setRequests(requests.filter((r) => r.id !== id))
      toast.error(`Club "${name}" rechazado`)
    } catch (error) {
      toast.error("Error al rechazar el club")
    } finally {
      setLoadingId(null)
    }
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
        No hay solicitudes pendientes de aprobación.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {requests.map((request) => {
        const initials = request.name
          ? request.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
          : "C"
        
        const createdDate = request.createdAt ? new Date(request.createdAt) : new Date()

        return (
          <div key={request.id} className="flex flex-col gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
            <div className="flex items-center">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-amber-100 text-amber-700 font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{request.name}</p>
                <p className="text-sm text-muted-foreground">{request.email}</p>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                {format(createdDate, "d MMM yyyy", { locale: es })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={loadingId !== null}
                onClick={() => handleReject(request.id, request.name)}
              >
                {loadingId === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XIcon className="mr-1 h-4 w-4" />
                    Rechazar
                  </>
                )}
              </Button>
              <Button 
                size="sm" 
                disabled={loadingId !== null}
                onClick={() => handleApprove(request.id, request.name)}
              >
                {loadingId === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckIcon className="mr-1 h-4 w-4" />
                    Aprobar
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
