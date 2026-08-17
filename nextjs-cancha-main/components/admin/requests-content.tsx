"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckIcon, ClockIcon, SearchIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rejectClub, approveClub, getAllClubs } from "@/lib/club"

export function AdminRequestsContent() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClub, setSelectedClub] = useState<any | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [pendingClubsList, setPendingClubsList] = useState<any[]>([])
  const [approvedClubsList, setApprovedClubsList] = useState<any[]>([])

  useEffect(() => {
    const fetchAllRequest = async()=>{
      const clubs = await getAllClubs()
      const pending = clubs.filter((club:any) => club.status== 'PENDING')
      const approved = clubs.filter((club:any) => club.status == 'APPROVED')
      setPendingClubsList(pending)
      setApprovedClubsList(approved)
    }
    fetchAllRequest()
  }, [])

  // Filtrar clubes según la búsqueda
  const filteredPendingClubs = pendingClubsList.filter(
    (club) =>
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.city.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredApprovedClubs = approvedClubsList.filter(
    (club) =>
      club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      club.city.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleViewDetails = (club: any) => {
    setSelectedClub(club)
    setIsDialogOpen(true)
  }

  const handleApprove = async (club: any) => {
    setIsLoading(true)
    try {

     const data =  await approveClub(club.id)

      // Actualizar listas
      setPendingClubsList(pendingClubsList.filter((c) => c.id !== data.id))

      const approvedClub = {
        ...club,
        approvedAt: new Date(),
      }

      setApprovedClubsList([approvedClub, ...approvedClubsList])

      toast.success(`Club "${club.name}" aprobado correctamente`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al aprobar el club")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async (club: any) => {
    setIsLoading(true)
    try {
      const data = await rejectClub(club.id)
      // Actualizar lista
      setPendingClubsList(pendingClubsList.filter((c) => c.id !== data.id))

      toast.error(`Club "${club.name}" rechazado`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al rechazar el club")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Solicitudes de Clubes</h2>
        <p className="text-muted-foreground">Gestiona las solicitudes de registro de clubes deportivos.</p>
      </div>

      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Pendientes
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {pendingClubsList.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4" />
              Aprobados
            </TabsTrigger>
          </TabsList>

        <div className="relative w-full sm:w-auto">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clubes..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <TabsContent value="pending" className="mt-0">
        {filteredPendingClubs.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPendingClubs.map((club) => (
              <Card key={club.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {club.name
                            .split(" ")
                            .map((n:any) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{club.name}</CardTitle>
                        <CardDescription>{club.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-500">
                      <ClockIcon className="mr-1 h-3 w-3" />
                      Pendiente
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Ubicación:</span> {club.address}
                    </div>
                    <div>
                      <span className="font-medium">Fecha de solicitud:</span>{" "}
                      {format(club.createdAt, "d MMM yyyy", { locale: es })}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground">{club.description}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => handleViewDetails(club)}>
                    Ver detalles
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => handleReject(club)}>
                      <XIcon className="mr-1 h-4 w-4" />
                      Rechazar
                    </Button>
                    <Button size="sm" onClick={() => handleApprove(club)}>
                      <CheckIcon className="mr-1 h-4 w-4" />
                      Aprobar
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckIcon className="mb-4 h-12 w-12 text-green-500" />
              <h3 className="text-xl font-medium">No hay solicitudes pendientes</h3>
              <p className="mt-2 text-muted-foreground">Todas las solicitudes de clubes han sido procesadas.</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="approved" className="mt-0">
        {filteredApprovedClubs.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredApprovedClubs.map((club) => (
              <Card key={club.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {club.name
                            .split(" ")
                            .map((n:any) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{club.name}</CardTitle>
                        <CardDescription>{club.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-500">
                      <CheckIcon className="mr-1 h-3 w-3" />
                      Aprobado
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Ubicación:</span> {club.address}
                    </div>
                    <div>
                      <span className="font-medium">Fecha de aprobación:</span>{" "}
                      {format(club.approvedAt, "d MMM yyyy", { locale: es })}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground">{club.description}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => handleViewDetails(club)}>
                    Ver detalles
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <XIcon className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-medium">No hay clubes aprobados</h3>
              <p className="mt-2 text-muted-foreground">Aún no has aprobado ningún club.</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      </Tabs>

      {/* Diálogo de detalles del club */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent className="sm:max-w-[600px]">
    {selectedClub ? (
      <>
        <DialogHeader>
          <DialogTitle>Detalles del Club</DialogTitle>
          <DialogDescription>
            Información completa del club deportivo {selectedClub.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* ...todo el contenido de detalles... */}
        </div>

        <DialogFooter>
          {!selectedClub.approvedAt ? (
            <>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReject(selectedClub)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ClockIcon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XIcon className="mr-2 h-4 w-4" />
                )}
                Rechazar
              </Button>
              <Button onClick={() => handleApprove(selectedClub)} disabled={isLoading}>
                {isLoading ? (
                  <ClockIcon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="mr-2 h-4 w-4" />
                )}
                Aprobar
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
          )}
        </DialogFooter>
      </>
    ) : (
      // fallback por accesibilidad
      <DialogHeader>
        <DialogTitle>Club no seleccionado</DialogTitle>
        <DialogDescription>Selecciona un club para ver sus detalles.</DialogDescription>
      </DialogHeader>
    )}
  </DialogContent>
</Dialog>

      {/* {selectedClub && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalles del Club</DialogTitle>
              <DialogDescription>Información completa del club deportivo {selectedClub.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {selectedClub.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-medium">{selectedClub.name}</h3>
                  <p className="text-muted-foreground">{selectedClub.email}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium">Teléfono</h4>
                    <p className="text-sm text-muted-foreground">{selectedClub.phone}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Distrito</h4>
                    <p className="text-sm text-muted-foreground">{selectedClub.district}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Dirección</h4>
                  <p className="text-sm text-muted-foreground">{selectedClub.address}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Descripción</h4>
                  <p className="text-sm text-muted-foreground">{selectedClub.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium">Fecha de solicitud</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedClub.createdAt, "d MMMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>

                {selectedClub.approvedAt && (
                  <div>
                    <h4 className="text-sm font-medium">Fecha de aprobación</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(selectedClub.approvedAt, "d MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              {!selectedClub.approvedAt ? (
                <>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={() => handleReject(selectedClub)} disabled={isLoading}>
                    {isLoading ? (
                      <ClockIcon className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XIcon className="mr-2 h-4 w-4" />
                    )}
                    Rechazar
                  </Button>
                  <Button onClick={() => handleApprove(selectedClub)} disabled={isLoading}>
                    {isLoading ? (
                      <ClockIcon className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckIcon className="mr-2 h-4 w-4" />
                    )}
                    Aprobar
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )} */}
    </div>
  )
}
