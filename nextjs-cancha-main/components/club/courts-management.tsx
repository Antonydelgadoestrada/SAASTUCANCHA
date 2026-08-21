"use client"

import { useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CourtForm } from "@/components/club/court-form"

interface Court {
  id: number
  name: string
  venue: string
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
}

// Datos de ejemplo
const initialCourtsData: Court[] = [
  {
    id: 1,
    name: "Cancha de Fútbol 5",
    venue: "Sede Central",
    venueId: 1,
    type: "futbol",
    surface: "Césped sintético",
    priceDay: 35,
    priceNight: 45,
    promoDay: 30,
    promoNight: 40,
    description: "Cancha de fútbol 5 con césped sintético de última generación.",
    images: ["/placeholder.svg?height=200&width=400&text=Cancha+Futbol"],
  },
  {
    id: 2,
    name: "Cancha de Tenis #1",
    venue: "Sede Central",
    venueId: 1,
    type: "tenis",
    surface: "Cemento",
    priceDay: 40,
    priceNight: 50,
    promoDay: null,
    promoNight: 45,
    description: "Cancha de tenis profesional con superficie de cemento.",
    images: ["/placeholder.svg?height=200&width=400&text=Cancha+Tenis"],
  },
]

const venues = [
  { id: 1, name: "Sede Central", address: "Av. Principal 123" },
  { id: 2, name: "Sede Norte", address: "Calle Norte 456" },
  { id: 3, name: "Sede Sur", address: "Av. Sur 789" },
]

export function CourtsManagement() {
  const [courts, setCourts] = useState<Court[]>(initialCourtsData)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCourt, setEditingCourt] = useState<Court | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVenue, setSelectedVenue] = useState<string>("all")

  // Filtrar canchas según la búsqueda y la sede seleccionada
  const filteredCourts = courts.filter((court) => {
    const matchesSearch =
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.surface.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesVenue = selectedVenue === "all" || court.venue === selectedVenue

    return matchesSearch && matchesVenue
  })

  const handleAddCourt = (courtData: any) => {
    const venue = venues.find((v) => v.id.toString() === courtData.venueId)
    const newCourt: Court = {
      ...courtData,
      id: Math.max(...courts.map((c) => c.id), 0) + 1,
      venue: venue?.name || "",
      venueId: Number.parseInt(courtData.venueId),
    }
    setCourts([...courts, newCourt])
    setIsAddDialogOpen(false)
    toast.success("Cancha creada correctamente")
  }

  const handleEditCourt = (courtData: any) => {
    const venue = venues.find((v) => v.id.toString() === courtData.venueId)
    const updatedCourt: Court = {
      ...courtData,
      venue: venue?.name || "",
      venueId: Number.parseInt(courtData.venueId),
    }
    setCourts(courts.map((c) => (c.id === courtData.id ? updatedCourt : c)))
    setEditingCourt(null)
    toast.success("Cancha actualizada correctamente")
  }

  const handleDeleteCourt = (id: number) => {
    setCourts(courts.filter((court) => court.id !== id))
    toast.success("Cancha eliminada correctamente")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-4">
          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas las sedes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sedes</SelectItem>
              {venues.map((venue) => venue.name ? (
                <SelectItem key={venue.id} value={venue.name}>
                  {venue.name}
                </SelectItem>
              ) : null)}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Input
              placeholder="Buscar canchas..."
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
        </div>

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
            <CourtForm onSubmit={handleAddCourt} venues={venues} onCancel={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

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
                    {court.venue}
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
                    <DropdownMenuItem onClick={() => setEditingCourt(court)}>
                      <PencilIcon className="mr-2 h-4 w-4" />
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
                  <span className="text-sm text-muted-foreground">Tipo:</span>
                  <span className="text-sm capitalize">{court.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Superficie:</span>
                  <span className="text-sm">{court.surface}</span>
                </div>
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
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Ver Horarios</Button>
              <Button onClick={() => setEditingCourt(court)}>Editar</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Diálogo para editar cancha */}
      {editingCourt && (
        <Dialog open={!!editingCourt} onOpenChange={(open) => !open && setEditingCourt(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Editar Cancha</DialogTitle>
              <DialogDescription>Modifica los detalles de la cancha.</DialogDescription>
            </DialogHeader>
            <CourtForm
              court={editingCourt}
              onSubmit={handleEditCourt}
              venues={venues}
              onCancel={() => setEditingCourt(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
