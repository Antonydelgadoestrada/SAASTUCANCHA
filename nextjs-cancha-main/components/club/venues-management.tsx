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
import { VenueForm } from "@/components/club/venue-form"

interface Venue {
  id: number
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  email: string
  description: string
  image?: string
  capacity?: string
  parkingSpots?: string
  openingHours?: string
  services?: string[]
  accessibilityFeatures?: string
  nearbyTransport?: string
  specialInstructions?: string
}

// Datos de ejemplo
const initialVenuesData: Venue[] = [
  {
    id: 1,
    name: "Sede Central",
    address: "Av. Principal 123",
    city: "Lima",
    state: "Lima",
    zipCode: "15001",
    phone: "123-456-7890",
    email: "central@clubdeportivo.com",
    description: "Sede principal con 5 canchas de fútbol, 3 de tenis y 2 de pádel.",
    image: "/placeholder.svg?height=200&width=400&text=Sede+Central",
    capacity: "200 personas",
    parkingSpots: "50 espacios gratuitos",
    openingHours: "Lunes a Domingo 6:00 - 22:00",
    services: ["parking", "lockers", "showers", "cafeteria", "wifi"],
    accessibilityFeatures: "Rampas para sillas de ruedas, baños adaptados",
    nearbyTransport: "Metro Línea 1, Estación Central - 200m",
    specialInstructions: "Ingreso por puerta principal",
  },
  {
    id: 2,
    name: "Sede Norte",
    address: "Calle Norte 456",
    city: "Lima",
    state: "Lima",
    zipCode: "15002",
    phone: "123-456-7891",
    email: "norte@clubdeportivo.com",
    description: "Sede con 3 canchas de fútbol y 2 de básquet.",
    image: "/placeholder.svg?height=200&width=400&text=Sede+Norte",
    capacity: "150 personas",
    parkingSpots: "30 espacios",
    openingHours: "Lunes a Domingo 7:00 - 21:00",
    services: ["parking", "showers", "security"],
    accessibilityFeatures: "Acceso para sillas de ruedas",
    nearbyTransport: "Bus 201, Paradero Norte",
    specialInstructions: "Toque el timbre para acceso nocturno",
  },
]

export function VenuesManagement() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.city.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleAddVenue = (venueData: any) => {
    const newVenue: Venue = {
      ...venueData,
      id: Math.max(...venues.map((v) => v.id), 0) + 1,
    }
    setVenues([...venues, newVenue])
    setIsAddDialogOpen(false)
    toast.success("Sede creada correctamente")
  }

  const handleEditVenue = (venueData: any) => {
    setVenues(venues.map((v) => (v.id === venueData.id ? { ...venueData } : v)))
    setEditingVenue(null)
    toast.success("Sede actualizada correctamente")
  }

  const handleDeleteVenue = (id: number) => {
    setVenues(venues.filter((venue) => venue.id !== id))
    toast.success("Sede eliminada correctamente")
  }

  return (
    <div className="space-y-6">
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Agregar Nueva Sede</DialogTitle>
              <DialogDescription>Completa los detalles para agregar una nueva sede a tu club.</DialogDescription>
            </DialogHeader>
            <VenueForm onSubmit={handleAddVenue} onCancel={() => setIsAddDialogOpen(false)} />
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
                    {venue.address}
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
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Ciudad:</span> {venue.city}, {venue.state}
                </div>
                <div>
                  <span className="font-medium">Teléfono:</span> {venue.phone}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {venue.email}
                </div>
                <div>
                  <span className="font-medium">Capacidad:</span> {venue.capacity}
                </div>
                <p className="line-clamp-2 text-muted-foreground">{venue.description}</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Ver Canchas</Button>
              <Button onClick={() => setEditingVenue(venue)}>Editar</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Diálogo para editar sede */}
      {editingVenue && (
        <Dialog open={!!editingVenue} onOpenChange={(open) => !open && setEditingVenue(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Editar Sede</DialogTitle>
              <DialogDescription>Modifica los detalles de la sede.</DialogDescription>
            </DialogHeader>
            <VenueForm venue={editingVenue} onSubmit={handleEditVenue} onCancel={() => setEditingVenue(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
