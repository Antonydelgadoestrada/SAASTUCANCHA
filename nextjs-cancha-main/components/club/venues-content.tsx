"use client"

import { useEffect, useState } from "react"
import { MapPinIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { VenueForm } from "@/components/club/venue-form"
import type { Venue } from "@/lib/types"
import { create, deleteVenue, edit, getAllVenues } from "@/lib/venues"
import { getAllCourtsByVenues } from "@/lib/courts"

export function VenuesContent() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [viewingVenue, setViewingVenue] = useState<Venue | null>(null)

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const data = await getAllVenues()
        setVenues(data)
      } catch (error) {
        toast.error("Error al cargar las sedes")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchCourts = async () => {
      try {
        const data = await getAllCourtsByVenues()
        setCourts(data || [])
      } catch (error) {
        console.error("Error al cargar las canchas", error)
      }
    }

    fetchVenues()
    fetchCourts()
  }, [])

  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue?.location?.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddVenue = async (venue: Omit<Venue, "id">) => {
    setIsLoading(true)

    try {
      const newVenue = await create(venue)
      setVenues([...venues, newVenue])
      setIsAddDialogOpen(false)
      toast.success("Sede creada correctamente")
    } catch (error) {
      toast.error("Error al crear la sede")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditVenue = async (venue: Venue) => {
    setIsLoading(true)

    try {
      const result = await edit(venue)
      setVenues(venues.map((v) => (v.id === result.id ? result : v)))
      setEditingVenue(null)
      toast.success("Sede actualizada correctamente")
    } catch (error) {
      toast.error("Error al actualizar la sede")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteVenue = async (id: number) => {
    setIsLoading(true)

    try {
      // Simular retraso de red
      // await new Promise((resolve) => setTimeout(resolve, 1500))
      await deleteVenue(id);
      setVenues(venues.filter((venue) => venue.id !== id))
      toast.success("Sede eliminada correctamente")
    } catch (error) {
      toast.error("Error al eliminar la sede, debido a que se debe eliminar primero las canchas")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Gestión de Sedes</h2>
          <p className="text-muted-foreground">Administra las sedes de tu club deportivo.</p>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Buscar sedes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Agregar Sede
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nueva Sede</DialogTitle>
              <DialogDescription>Completa los detalles para agregar una nueva sede a tu club.</DialogDescription>
            </DialogHeader>
            <VenueForm onSubmit={handleAddVenue}  onCancel={() => setIsAddDialogOpen(false)}  />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVenues.map((venue) => (
          <Card key={venue.id} className="overflow-hidden">
            <div className="aspect-video w-full overflow-hidden">
              <img
                src={venue.image || "/placeholder.svg?height=200&width=400&text=Sede"}
                alt={venue.name}
                className="h-full w-full object-cover"
              />
            </div>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{venue.name}</CardTitle>
                  <CardDescription className="flex items-center">
                    <MapPinIcon className="mr-1 h-4 w-4" />
                    {venue?.location?.address}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingVenue(venue)}>
                      <PencilIcon className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteVenue(venue.id)}>
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {/* <div>
                  <span className="font-medium">Ciudad:</span> {venue.city}, {venue.state}
                </div> */}
                <div>
                  <span className="font-medium">Teléfono:</span> {venue.phone}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {venue.email}
                </div>
                <p className="line-clamp-2 text-muted-foreground">{venue.description}</p>
              </div>

              <div className="border-t pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Canchas ({(() => {
                    const venueCourts = courts.filter((c) => c.venue?.id === venue.id || c.venueId === venue.id);
                    return venueCourts.length;
                  })()})
                </span>
                {(() => {
                  const venueCourts = courts.filter((c) => c.venue?.id === venue.id || c.venueId === venue.id);
                  if (venueCourts.length === 0) {
                    return <p className="text-xs text-muted-foreground italic">No hay canchas registradas en esta sede.</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {venueCourts.map((court) => (
                        <Badge key={court.id} variant="secondary" className="text-xs px-2 py-0.5 font-semibold">
                          {court.name}
                        </Badge>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setViewingVenue(venue)}>
                Ver Detalles
              </Button>
              <Button onClick={() => setEditingVenue(venue)}>Editar</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Diálogo para editar sede */}
      {editingVenue && (
        <Dialog open={!!editingVenue} onOpenChange={(open) => !open && setEditingVenue(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Sede</DialogTitle>
              <DialogDescription>Modifica los detalles de la sede.</DialogDescription>
            </DialogHeader>
            <VenueForm venue={editingVenue} onSubmit={handleEditVenue}  onCancel={() => setEditingVenue(null)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo para ver detalles de la sede */}
      {viewingVenue && (
        <Dialog open={!!viewingVenue} onOpenChange={(open) => !open && setViewingVenue(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewingVenue.name}</DialogTitle>
              <DialogDescription>Detalles completos de la sede</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="aspect-video w-full overflow-hidden rounded-md">
                <img
                  src={viewingVenue.image || "/placeholder.svg?height=200&width=400&text=Sede"}
                  alt={viewingVenue.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="grid gap-2">
                <div>
                  <h3 className="font-medium">Dirección</h3>
                  <p className="text-sm text-muted-foreground">{viewingVenue?.location?.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Teléfono</h3>
                    <p className="text-sm text-muted-foreground">{viewingVenue.phone}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Email</h3>
                    <p className="text-sm text-muted-foreground">{viewingVenue.email}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Descripción</h3>
                  <p className="text-sm text-muted-foreground">{viewingVenue.description}</p>
                </div>

                <div className="border-t pt-3 mt-2">
                  <h3 className="font-bold text-sm mb-2 uppercase tracking-wider text-muted-foreground">Canchas en esta sede</h3>
                  {(() => {
                    const venueCourts = courts.filter((court) => court.venue?.id === viewingVenue.id || court.venueId === viewingVenue.id);
                    if (venueCourts.length === 0) {
                      return <p className="text-sm text-muted-foreground italic">No hay canchas registradas en esta sede.</p>;
                    }
                    return (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {venueCourts.map((court) => (
                          <div key={court.id} className="p-3 border rounded-lg bg-muted/40 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-sm">{court.name}</h4>
                              <p className="text-xs text-muted-foreground capitalize">Tipo: {court.type} | Superficie: {court.surface}</p>
                            </div>
                            <p className="text-xs font-semibold mt-2 text-primary">S/ {court.priceDay}/hora (Día) | S/ {court.priceNight}/hora (Noche)</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setViewingVenue(null)}>
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    setViewingVenue(null)
                    setEditingVenue(viewingVenue)
                  }}
                >
                  Editar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
