"use client"

import { useState } from "react"
import { CalendarIcon, MapIcon, MapPinIcon, SearchIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { sportTypes } from "@/lib/sports"

// Datos de ejemplo

const locations = [
  { value: "norte", label: "Zona Norte" },
  { value: "sur", label: "Zona Sur" },
  { value: "este", label: "Zona Este" },
  { value: "oeste", label: "Zona Oeste" },
  { value: "centro", label: "Centro" },
]

const courts = [
  {
    id: 1,
    name: "Cancha de Fútbol 5",
    venue: "Club Deportivo Norte",
    location: "Av. Ejemplo 123, Zona Norte",
    sport: "futbol",
    price: 35,
    rating: 4.5,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 1",
  },
  {
    id: 2,
    name: "Cancha de Tenis #3",
    venue: "Club Deportivo Central",
    location: "Calle Principal 456, Centro",
    sport: "tenis",
    price: 40,
    rating: 4.8,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 2",
  },
  {
    id: 3,
    name: "Cancha de Pádel #2",
    venue: "Club Deportivo Este",
    location: "Av. Del Este 789, Zona Este",
    sport: "padel",
    price: 25,
    rating: 4.2,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 3",
  },
  {
    id: 4,
    name: "Cancha de Básquet",
    venue: "Polideportivo Municipal",
    location: "Av. Central 321, Centro",
    sport: "basquet",
    price: 30,
    rating: 4.0,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 4",
  },
  {
    id: 5,
    name: "Cancha de Fútbol 7",
    venue: "Club Deportivo Sur",
    location: "Calle Sur 654, Zona Sur",
    sport: "futbol",
    price: 45,
    rating: 4.7,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 5",
  },
  {
    id: 6,
    name: "Cancha de Vóley",
    venue: "Club Deportivo Oeste",
    location: "Av. Oeste 987, Zona Oeste",
    sport: "voley",
    price: 20,
    rating: 3.9,
    image: "/placeholder.svg?height=200&width=400&text=Cancha 6",
  },
]

export function SearchCourts() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [sport, setSport] = useState<string>("all")
  const [location, setLocation] = useState<string>("all")
  const [view, setView] = useState<"list" | "map">("list")

  // Filtrar canchas según los criterios seleccionados
  const filteredCourts = courts.filter((court) => {
    if (sport !== "all" && court.sport !== sport) return false
    if (location !== "all" && !court.location.toLowerCase().includes(location.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Buscar Canchas</h2>
        <p className="text-muted-foreground">Encuentra y reserva canchas deportivas disponibles.</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Deporte</label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar deporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los deportes</SelectItem>
                  {sportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Ubicación</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <MapPinIcon className="mr-2 h-4 w-4" />
                    {location !== "all"
                      ? locations.find((loc) => loc.value === location)?.label
                      : "Seleccionar ubicación"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar ubicación..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron ubicaciones.</CommandEmpty>
                      <CommandGroup>
                        {locations.map((loc) => (
                          <CommandItem
                            key={loc.value}
                            value={loc.value}
                            onSelect={(value) => {
                              setLocation(value === location ? "all" : value)
                            }}
                          >
                            {loc.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button className="w-full gap-2">
                <SearchIcon className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Resultados de búsqueda</h3>
          <p className="text-sm text-muted-foreground">{filteredCourts.length} canchas encontradas</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="map">Mapa</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={view} className="w-full">
        <TabsContent value="list" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourts.map((court) => (
              <Card key={court.id} className="overflow-hidden">
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={court.image || "/placeholder.svg"}
                    alt={court.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle>{court.name}</CardTitle>
                  <CardDescription>{court.venue}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPinIcon className="mr-1 h-4 w-4" />
                    <span>{court.location}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-medium">${court.price}/hora</span>
                    <div className="flex items-center space-x-1">
                      {Array(5)
                        .fill(null)
                        .map((_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${i < Math.floor(court.rating) ? "fill-primary" : "fill-muted"}`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                        ))}
                      {/* <span className="ml-1 text-xs text-muted-foreground">{court.rating}</span> */}
                      <span className="ml-1 text-xs text-muted-foreground">5.0</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Ver disponibilidad</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="map" className="mt-0">
          <Card className="overflow-hidden">
            <div className="aspect-[21/9] w-full bg-muted">
              <div className="flex h-full items-center justify-center">
                <MapIcon className="h-16 w-16 text-muted-foreground" />
                <span className="sr-only">Mapa interactivo</span>
              </div>
            </div>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Mapa interactivo con ubicación de canchas disponibles</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
