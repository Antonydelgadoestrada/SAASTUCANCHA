"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarIcon, SearchIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { cn } from "@/lib/utils"
import { sportTypes, timeSlots } from "@/lib/sports"
import { toast } from "sonner"

// Datos de ejemplo - Deportes

export function PublicSearchForm() {
  const router = useRouter()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [sport, setSport] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationQuery, setLocationQuery] = useState<string>("")

  const handlePlaceSelect = (place: any, coordinates: { lat: number; lng: number }) => {
    setSelectedLocation(coordinates)
    setLocationQuery(place)
  }
  // const isFormValid = sport && date && selectedTime && selectedLocation
  const isFormValid = sport && date && selectedTime && selectedLocation?.lat && selectedLocation?.lng

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      toast.error("Por favor completa todos los campos requeridos.")
      return
    }
    // Construir la URL de búsqueda con los parámetros seleccionados
    const searchParams = new URLSearchParams()
    
    if (sport) searchParams.append("sport", sport)
    if (date) searchParams.append("date", date.toISOString())
    if (selectedLocation) {
      searchParams.append("lat", selectedLocation.lat.toString())
      searchParams.append("lng", selectedLocation.lng.toString())
    }
    if (locationQuery) searchParams.append("location", locationQuery)
    if (selectedTime) searchParams.append("time", selectedTime)

    // Redirigir a la página de resultados de búsqueda
    router.push(`/search?${searchParams.toString()}`)
  }

  return (
    <Card className="overflow-hidden border-none shadow-lg">
      <CardContent className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Primera fila - Búsqueda y ubicación */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Ubicación</label>
              <GooglePlacesAutocomplete
                placeholder="Distrito, dirección o lugar..."
                onPlaceSelect={handlePlaceSelect}
                value={locationQuery}
                onChange={setLocationQuery}
              />
            </div>
            <div>
                <label className="mb-2 block text-sm font-medium">Hora</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar la hora" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

          </div>

          {/* Segunda fila - Filtros */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Deporte</label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar deporte" />
                </SelectTrigger>
                <SelectContent>
                  {sportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={sport === "futbol" ? "md:col-start-3" : ""}>
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
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" disabled={!isFormValid}>
                <SearchIcon className="h-4 w-4" />
                Buscar Canchas
              </Button>
            </div>
          </div>

          {/* Información de ubicación seleccionada */}
          {selectedLocation && locationQuery && (
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2 text-sm">
                <SearchIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">Buscando cerca de:</span>
                <span>{locationQuery}</span>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
