"use client"

import { useEffect, useState } from "react"
import { EditIcon, MapPinIcon, PlusIcon, TrashIcon } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CourtForm } from "@/components/club/court-form"
import { createCourts, deleteCourts, editCourts, getAllCourtsByVenues } from "@/lib/courts"
import { getAllVenues } from "@/lib/venues"
import { applyTemplateToCourtSafe, getTemplateByClub } from "@/lib/schedule"

interface Court {
  id: number
  name: string
  venue: {
    id: number
    name: string
    address: string
    [key: string]: any // para evitar errores si vienen más propiedades
  }
  venueId: number
  type: string
  surface: string
  priceDay: number
  priceNight: number
  promoDay?: number | null
  promoNight?: number | null
  description?: string
  images?: string[]
  image?: string
  location?: {
    address: string
    coordinates: { lat: number; lng: number }
  }
  
}

export interface VenueDTO {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  description: string;
  image: string;
  capacity: string;
  parkingSpots: string;
  openingHours: string;
  services: string[];
  accessibilityFeatures: string;
  nearbyTransport: string;
  specialInstructions: string;
}
export type Venues = Partial<VenueDTO>;


export function ClubCourtsContent() {
  const [courts, setCourts] = useState<Court[]>([])
  const [venues, setVenues] = useState<Venues[]>([])
  const [templates, setTemplates] = useState<any[]>([]);

  const [view, setView] = useState<"grid" | "table">("grid")
  const [selectedVenue, setSelectedVenue] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await getTemplateByClub();
        if (Array.isArray(data)) {
          setTemplates(data); // si ya es array
        } else if (data) {
          setTemplates([data]); // si es un solo objeto
        } else {
          setTemplates([]); // si es null/undefined
        }
      } catch (err) {
        toast.error("Error al obtener plantillas");
        setTemplates([]);
      }
    };

    const fetchCourts = async () => {
      try {
        const data = await getAllCourtsByVenues()
        const transformed = data.map((court: any) => ({
          ...court,
          venueId: court.venue?.id ?? 0,
        }))
        setCourts(transformed)
      } catch (error) {
        toast.error("Error al cargar las canchas")
      }
    }
    
    const fetchVenues = async ()=>{
      try {
        const result = await getAllVenues()
        setVenues(result)
      } catch (error) {
        toast.error("Error al cargar las canchas")
      }
    }
    fetchVenues()
    fetchCourts()
    fetchTemplates();

  }, [])
  // Filtrar canchas según la sede seleccionada y búsqueda
  const filteredCourts = courts.filter((court) => {
    const matchesVenue = selectedVenue === "all" || court.venue?.name === selectedVenue
    const matchesSearch =
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.surface.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesVenue && matchesSearch
  })

  const handleAddCourt = async (courtData: any) => {
    if(templates.length==0) {
      toast.error("Para crear cancha se debe tener una plantilla")
      return;
    }
    const result = await createCourts(courtData);
    setCourts((prev) => [...prev, result ])
    setIsAddDialogOpen(false)
    toast.success("Cancha creada correctamente")
  }

  const handleEditCourt = async(courtData: any) => {
    const updatedCourt = await editCourts(courtData)

    setCourts((prev) => prev.map((court) => (court.id === courtData.id ? updatedCourt : court)))
    setEditingCourt(null)
    toast.success("Cancha actualizada correctamente")
  }

  const handleDeleteCourt = async (id: number) => {
    await deleteCourts(id)
    setCourts((prev) => prev.filter((court) => court.id !== id))
    toast.success("Cancha eliminada correctamente")
  }

  const openEditDialog = (court: Court) => {
    setEditingCourt(court)
  }

  const closeEditDialog = () => {
    setEditingCourt(null)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Gestión de Canchas</h2>
        <p className="text-muted-foreground">Administra las canchas deportivas de tu club.</p>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-4">
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas las sedes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sedes</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.name ?? '' }>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Input
              placeholder="Buscar canchas..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "table")}>
            <TabsList>
              <TabsTrigger value="grid">Cuadrícula</TabsTrigger>
              <TabsTrigger value="table">Tabla</TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="mr-2 h-4 w-4" />
                Agregar Cancha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Agregar Nueva Cancha</DialogTitle>
                <DialogDescription>Completa los detalles para agregar una nueva cancha a tu club.</DialogDescription>
              </DialogHeader>
              <CourtForm onSubmit={handleAddCourt} venues={venues} onCancel={() => setIsAddDialogOpen(false)} templates={templates} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={view} className="w-full">
        <TabsContent value="grid" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourts.map((court) => (
              <Card key={court.id} className="overflow-hidden">
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={court.images?.[0] || court.image || "/placeholder.svg?height=200&width=400&text=Cancha"}
                    alt={court.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{court.name}</CardTitle>
                      <CardDescription className="flex items-center">
                        <MapPinIcon className="mr-1 h-4 w-4" />
                        {court.venue?.name}
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
                        <DropdownMenuItem onClick={() => openEditDialog(court)}>
                          <EditIcon className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCourt(court.id)}>
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio día:</span>
                      <div>
                        {court.promoDay ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm line-through text-muted-foreground">S/ {court.priceDay}</span>
                            <span className="font-medium text-primary">S/ {court.promoDay}</span>
                          </div>
                        ) : (
                          <span className="font-medium">S/ {court.priceDay}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio noche:</span>
                      <div>
                        {court.promoNight ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm line-through text-muted-foreground">S/ {court.priceNight}</span>
                            <span className="font-medium text-primary">S/ {court.promoNight}</span>
                          </div>
                        ) : (
                          <span className="font-medium">S/ {court.priceNight}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Superficie:</span>
                      <span className="text-sm">{court.surface}</span>
                    </div>
                  </div>
                </CardContent>
                
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-medium">Nombre</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Sede</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Tipo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Superficie</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Precio Día</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Precio Noche</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourts.map((court) => (
                      <tr key={court.id} className="border-b">
                        <td className="px-4 py-3 text-sm">{court.name}</td>
                        <td className="px-4 py-3 text-sm">{court.venue?.name}</td>
                        <td className="px-4 py-3 text-sm capitalize">{court.type}</td>
                        <td className="px-4 py-3 text-sm">{court.surface}</td>
                        <td className="px-4 py-3 text-sm">
                          {court.promoDay ? (
                            <div className="flex items-center gap-2">
                              <span className="line-through text-muted-foreground">S/ {court.priceDay}</span>
                              <span className="font-medium text-primary">S/ {court.promoDay}</span>
                            </div>
                          ) : (
                            <span>S/ {court.priceDay}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {court.promoNight ? (
                            <div className="flex items-center gap-2">
                              <span className="line-through text-muted-foreground">S/ {court.priceNight}</span>
                              <span className="font-medium text-primary">S/ {court.promoNight}</span>
                            </div>
                          ) : (
                            <span>S/ {court.priceNight}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(court)}>
                              <EditIcon className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCourt(court.id)}>
                              <TrashIcon className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar cancha */}
      <Dialog open={!!editingCourt} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Editar Cancha</DialogTitle>
            <DialogDescription>Modifica los detalles de la cancha.</DialogDescription>
          </DialogHeader>
          {editingCourt && (
            <CourtForm court={editingCourt} onSubmit={handleEditCourt} venues={venues} onCancel={closeEditDialog} templates={templates} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
