"use client"

import { useState, useEffect } from "react"
import { MapPinIcon, NavigationIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Datos de ejemplo (mismos que en search-results-advanced)
const allCourts = [
  {
    id: 1,
    name: "Cancha de Fútbol 5 Premium",
    venue: "Club Deportivo Norte",
    club: "club-norte",
    sport: "futbol",
    price: 35,
    rating: 4.5,
    coordinates: { lat: -12.0969, lng: -77.0378 },
    address: "Av. Javier Prado Este 123, San Isidro",
  },
  {
    id: 2,
    name: "Cancha de Fútbol 7 Profesional",
    venue: "Club Deportivo Sur",
    club: "club-sur",
    sport: "futbol",
    price: 45,
    rating: 4.7,
    coordinates: { lat: -12.1191, lng: -77.0282 },
    address: "Calle Los Pinos 456, Miraflores",
  },
  {
    id: 3,
    name: "Cancha de Fútbol 11 Estadio",
    venue: "Polideportivo Municipal",
    club: "polideportivo",
    sport: "futbol",
    price: 60,
    rating: 4.3,
    coordinates: { lat: -12.1391, lng: -76.9938 },
    address: "Av. Universitaria 789, Santiago de Surco",
  },
  {
    id: 4,
    name: "Cancha de Tenis Arcilla",
    venue: "Club Deportivo Central",
    club: "club-central",
    sport: "tenis",
    price: 40,
    rating: 4.8,
    coordinates: { lat: -12.0464, lng: -77.0428 },
    address: "Jr. Lampa 321, Cercado de Lima",
  },
  {
    id: 5,
    name: "Cancha de Tenis Dura",
    venue: "Club Deportivo Este",
    club: "club-este",
    sport: "tenis",
    price: 38,
    rating: 4.6,
    coordinates: { lat: -12.0792, lng: -76.9447 },
    address: "Av. La Molina 654, La Molina",
  },
  {
    id: 6,
    name: "Cancha de Pádel Cristal",
    venue: "Club Deportivo Este",
    club: "club-este",
    sport: "padel",
    price: 25,
    rating: 4.2,
    coordinates: { lat: -12.0792, lng: -76.9447 },
    address: "Av. La Molina 654, La Molina",
  },
]

const sportTypes = [
  { value: "futbol", label: "Fútbol", color: "bg-green-500" },
  { value: "tenis", label: "Tenis", color: "bg-blue-500" },
  { value: "padel", label: "Pádel", color: "bg-purple-500" },
  { value: "basquet", label: "Básquet", color: "bg-orange-500" },
  { value: "voley", label: "Vóley", color: "bg-red-500" },
]

interface MapViewProps {
  searchQuery?: string
  selectedSport?: string
  selectedTeamSize?: string 
  selectedClub?: string
  selectedPriceRange?: string
  currentLocation?: { lat: number; lng: number } | null
}

export function MapView({
  searchQuery,
  selectedSport,
  selectedClub,
  selectedPriceRange,
  currentLocation,
}: MapViewProps) {
  const [filteredCourts, setFilteredCourts] = useState(allCourts)
  const [selectedCourt, setSelectedCourt] = useState<(typeof allCourts)[0] | null>(null)

  useEffect(() => {
    let filtered = [...allCourts]

    // Aplicar los mismos filtros que en la vista de lista
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (court) =>
          court.name.toLowerCase().includes(query) ||
          court.venue.toLowerCase().includes(query) ||
          court.address.toLowerCase().includes(query),
      )
    }

    if (selectedSport) {
      filtered = filtered.filter((court) => court.sport === selectedSport)
    }

    if (selectedClub) {
      filtered = filtered.filter((court) => court.club === selectedClub)
    }

    if (selectedPriceRange) {
      const [min, max] = selectedPriceRange.split("-").map((p) => (p === "100+" ? 999 : Number.parseInt(p)))
      filtered = filtered.filter((court) => court.price >= min && (max ? court.price <= max : true))
    }

    setFilteredCourts(filtered)
  }, [searchQuery, selectedSport, selectedClub, selectedPriceRange])

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Mapa */}
      <div className="lg:col-span-2">
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-muted">
            {/* Simulación de mapa */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
              {/* Ubicación actual */}
              {currentLocation && (
                <div
                  className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg"
                  style={{
                    left: `${((currentLocation.lng + 77.1) / 0.2) * 100}%`,
                    top: `${((currentLocation.lat + 12.2) / -0.2) * 100}%`,
                  }}
                  title="Tu ubicación"
                >
                  <NavigationIcon className="h-3 w-3" />
                </div>
              )}

              {/* Marcadores de canchas */}
              {filteredCourts.map((court) => {
                const sportType = sportTypes.find((s) => s.value === court.sport)
                return (
                  <button
                    key={court.id}
                    className={`absolute flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110 ${
                      sportType?.color || "bg-gray-500"
                    } ${selectedCourt?.id === court.id ? "ring-4 ring-white" : ""}`}
                    style={{
                      left: `${((court.coordinates.lng + 77.1) / 0.2) * 100}%`,
                      top: `${((court.coordinates.lat + 12.2) / -0.2) * 100}%`,
                    }}
                    onClick={() => setSelectedCourt(court)}
                    title={court.name}
                  >
                    <MapPinIcon className="h-4 w-4" />
                  </button>
                )
              })}
            </div>

            {/* Leyenda */}
            <div className="absolute bottom-4 left-4 rounded-lg bg-background/90 p-3 shadow-lg">
              <h4 className="mb-2 text-sm font-medium">Leyenda</h4>
              <div className="space-y-1">
                {currentLocation && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-3 w-3 rounded-full bg-blue-600"></div>
                    <span>Tu ubicación</span>
                  </div>
                )}
                {sportTypes
                  .filter((sport) => filteredCourts.some((court) => court.sport === sport.value))
                  .map((sport) => (
                    <div key={sport.value} className="flex items-center gap-2 text-xs">
                      <div className={`h-3 w-3 rounded-full ${sport.color}`}></div>
                      <span>{sport.label}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Controles de zoom (simulados) */}
            <div className="absolute right-4 top-4 flex flex-col gap-1">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                +
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                −
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Panel de información */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Canchas en el mapa</CardTitle>
            <CardDescription>{filteredCourts.length} canchas encontradas</CardDescription>
          </CardHeader>
        </Card>

        {selectedCourt ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedCourt.name}</CardTitle>
                  <CardDescription>{selectedCourt.venue}</CardDescription>
                </div>
                <Badge variant="outline">{sportTypes.find((s) => s.value === selectedCourt.sport)?.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPinIcon className="h-4 w-4" />
                <span>{selectedCourt.address}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm">⭐</span>
                  <span className="font-medium">{selectedCourt.rating}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">S/ {selectedCourt.price}</div>
                  <div className="text-sm text-muted-foreground">por hora</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  Ver detalles
                </Button>
                <Button className="flex-1">Reservar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <MapPinIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Haz clic en un marcador del mapa para ver los detalles de la cancha
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lista de canchas */}
        <div className="space-y-2">
          {filteredCourts.map((court) => (
            <Card
              key={court.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedCourt?.id === court.id ? "bg-muted" : ""
              }`}
              onClick={() => setSelectedCourt(court)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{court.name}</h4>
                    <p className="text-sm text-muted-foreground">{court.venue}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">S/ {court.price}</div>
                    <div className="text-xs text-muted-foreground">⭐ {court.rating}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
