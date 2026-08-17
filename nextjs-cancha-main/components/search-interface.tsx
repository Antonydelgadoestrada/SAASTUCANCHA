"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MapPinIcon, SearchIcon, MapIcon, ListIcon, Navigation, CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { SearchResults } from "@/components/search-results-advanced"
import { MapView } from "@/components/map-view"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Club } from "@/lib/types"
import { getAllClubs } from "@/lib/club"
import { usePathname } from "next/navigation"
import { sportTypes, timeSlots } from "@/lib/sports"
import { useUserStore } from "@/stores/userStore"
import { parseISO } from "date-fns"
import { toZonedTime } from 'date-fns-tz'
import { Loader2 } from "lucide-react"


// Datos de ejemplo

export function SearchInterface() {
  const PERU_TZ = "America/Lima"
  const pathname = usePathname()
  const {user} = useUserStore((state) => state)
  const router = useRouter()
  const urlSearchParams = useSearchParams()
  const { toast } = useToast()
  const [clubs, setClubs] = useState<Club[]>([])
  const [searchQuery, setSearchQuery] = useState( "")
  const [selectedSport, setSelectedSport] = useState( "all")
  const [selectedTime, setSelectedTime] = useState<string>( "10:00")

  const [selectedClub, setSelectedClub] = useState( "all")
  const [selectedPriceRange, setSelectedPriceRange] = useState("all")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    // new Date(),
    undefined
  )
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>( null)
  const [locationQuery, setLocationQuery] = useState("")
  const [view, setView] = useState<"list" | "map">("list")
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [pendingReservation, setPendingReservation] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)


  // Verificar usuario logueado
  useEffect(() => {
 
    const fetchClub = async ()=>{
      try {
        const result = await getAllClubs()
        setClubs(result)
      } catch (error) {
        console.error("Error al cargar las canchas", error)
      }
    }
    fetchClub()
  }, [])
  

  useEffect(() => {
    const query = urlSearchParams.get("query") || ""
    const sport = urlSearchParams.get("sport") || "all"
    const club = urlSearchParams.get("club") || "all"
    const price = urlSearchParams.get("price") || "all"
    const dateStr = urlSearchParams.get("date")
    const lat = urlSearchParams.get("lat")
    const lng = urlSearchParams.get("lng")
    const location = urlSearchParams.get("location") || ""
    const time = urlSearchParams.get("time") || ""
  
    setSearchQuery(query)
    setSelectedSport(sport)
    setSelectedTime(time)
    setSelectedClub(club)
    setSelectedPriceRange(price)
    if(dateStr){
      const parsed    = dateStr ? parseISO(dateStr) : new Date();
      const zonedDate = toZonedTime(parsed, PERU_TZ); 
      // const randomDate = dateStr ? new Date(dateStr) : new Date()
      setSelectedDate(zonedDate)
    }

    if (lat && lng) {
      setCurrentLocation({ lat: parseFloat(lat), lng: parseFloat(lng) })
    }
    setLocationQuery(location)
    setIsSearching(false)
  }, [urlSearchParams])

  // Verificar reservas pendientes después del login
  useEffect(() => {
    if (user && typeof window !== "undefined") {
      const pending = localStorage.getItem("pendingReservation")
      if (pending) {
        try {
          const reservationData = JSON.parse(pending)
          setPendingReservation(reservationData)
          localStorage.removeItem("pendingReservation")

          toast({
            title: "¡Bienvenido de vuelta!",
            description: "Continuemos con tu reserva...",
          })
        } catch (error) {
          localStorage.removeItem("pendingReservation")
        }
      }
    }
  }, [user, toast])

  // Función para obtener ubicación actual
  const getCurrentLocation = useCallback(() => {
    setIsLoadingLocation(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setCurrentLocation({ lat: latitude, lng: longitude })
          setLocationQuery("Mi ubicación actual")
          setIsLoadingLocation(false)
          toast({
            title: "Ubicación obtenida",
            description: "Se ha obtenido tu ubicación actual correctamente",
          })
        },
        (error) => {
          setIsLoadingLocation(false)
          toast({
            title: "Error de ubicación",
            description: "No se pudo obtener tu ubicación. Verifica los permisos del navegador.",
            variant: "destructive",
          })
        },
      )
    } else {
      setIsLoadingLocation(false)
      toast({
        title: "Geolocalización no disponible",
        description: "Tu navegador no soporta geolocalización",
        variant: "destructive",
      })
    }
  }, [toast])

  // Manejar selección de lugar desde Google Places
  const handlePlaceSelect = useCallback(
    (place: any, coordinates: { lat: number; lng: number }) => {
      setCurrentLocation(coordinates)
      setLocationQuery(place)
      toast({
        title: "Ubicación seleccionada",
        description: `Buscando canchas cerca de ${place}`,
      })
    },
    [toast],
  )

  // Función para realizar búsqueda
 
  const handleSearch = 
    () => {
      setIsSearching(true)
    const params = new URLSearchParams()

    if (searchQuery) params.append("query", searchQuery)
    if (selectedSport !== "all") params.append("sport", selectedSport)
    if (selectedClub !== "all") params.append("club", selectedClub)
    if (selectedPriceRange !== "all") params.append("price", selectedPriceRange)
    // if (selectedDate) params.append("date", selectedDate.toISOString().split("T")[0])
    if (selectedDate) {
      const formattedDate = format(selectedDate, "yyyy-MM-dd") // SIN ZONAS HORARIAS
      params.append("date", formattedDate)
    }
    if (currentLocation) {
      params.append("lat", currentLocation.lat.toString())
      params.append("lng", currentLocation.lng.toString())
    }
    if (locationQuery) params.append("location", locationQuery)
    if (selectedTime) params.append("time", selectedTime)
        // 👇 Parámetro falso para forzar navegación aunque sea igual
    params.append("refresh", Date.now().toString())

    router.push(`${pathname}?${params.toString()}`)
  }

  // Función para limpiar filtros
  const clearFilters = useCallback(() => {
    setSearchQuery("")
    setSelectedSport("all")
    setSelectedTime("")
    setSelectedClub("all")
    setSelectedPriceRange("all")
    setSelectedDate(new Date())
    setCurrentLocation(null)
    setLocationQuery("")
    router.push(`${pathname}`)
  }, [router])

  // Obtener filtros activos
  const activeFilters = [
    searchQuery && { key: "query", label: `Búsqueda: ${searchQuery}` },
    selectedSport !== "all" && {
      key: "sport",
      label: `Deporte: ${sportTypes.find((s) => s.value === selectedSport)?.label}`,
    },
    selectedClub !== "all" && { key: "club", label: `Club: ${clubs.find((c) => c.id === selectedClub)?.name}` },
    selectedPriceRange !== "all" && { key: "price", label: `Precio: ${selectedPriceRange}` },
    selectedDate && { key: "date", label: `Fecha: ${format(selectedDate, "dd/MM/yyyy", { locale: es })}` },
    currentLocation && { key: "location", label: locationQuery || "Ubicación seleccionada" },
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Formulario de búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            Buscar Canchas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda por texto */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Buscar cancha o club</label>
              <Input
                placeholder="Nombre de cancha, club o características..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Buscar por ubicación</label>
              <GooglePlacesAutocomplete
                placeholder="Buscar distrito, dirección o lugar..."
                onPlaceSelect={handlePlaceSelect}
                value={locationQuery ?? ''}
                onChange={setLocationQuery}
              />
            </div>
          </div>

          {/* Botón de ubicación actual */}
          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={getCurrentLocation}
              disabled={isLoadingLocation}
              className="gap-2"
            >
              <Navigation className="h-4 w-4" />
              {isLoadingLocation ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
            </Button>
          </div>

          {/* Filtros */}
          <div className="grid gap-4 md:grid-cols-6">
            <div>
              <label className="mb-2 block text-sm font-medium">Fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Deporte</label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los deportes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los deportes</SelectItem>
                  {sportTypes.map((sport) => (
                    <SelectItem key={sport.value} value={sport.value}>
                      {sport.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
                <label className="mb-2 block text-sm font-medium">Hora</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar la hora" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem key={'all'} value={'all'}>
                            Todos los horarios
                      </SelectItem>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Club</label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clubes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clubes</SelectItem>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1" disabled={isSearching}>
              {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <SearchIcon className="mr-2 h-4 w-4" />

                Buscar
              </Button>
              {activeFilters.length > 0 && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Filtros activos */}
          {activeFilters.length > 0 && (
            <div>
              <Separator className="mb-3" />
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium">Filtros activos:</span>
                {activeFilters.map((filter, index) =>
                  filter && typeof filter === "object" && "key" in filter ? (
                    <Badge key={filter.key} variant="secondary" className="gap-1">
                      {filter.label}
                    </Badge>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Ubicación actual */}
          {currentLocation && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPinIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">Ubicación:</span>
                <span>{locationQuery || `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Resultados de búsqueda</h2>
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <ListIcon className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="map" className="gap-2">
              <MapIcon className="h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={view} className="w-full">
        <TabsContent value="list" className="mt-0">
          <SearchResults
            searchQuery={searchQuery}
            selectedSport={selectedSport}
            selectedClub={selectedClub}
            selectedPriceRange={selectedPriceRange}
            selectedDate={selectedDate}
            currentLocation={currentLocation}
            user={user}
            pendingReservation={pendingReservation}
            onClearPendingReservation={() => setPendingReservation(null)}
          />
        </TabsContent>
        <TabsContent value="map" className="mt-0">
          <MapView
            searchQuery={searchQuery}
            selectedSport={selectedSport}
            // selectedTeamSize={selectedTeamSize}
            selectedClub={selectedClub}
            selectedPriceRange={selectedPriceRange}
            currentLocation={currentLocation}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
