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
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Construir la URL de búsqueda con los parámetros seleccionados
    const searchParams = new URLSearchParams()
    
    if (sport) searchParams.append("sport", sport)
    if (date) searchParams.append("date", date.toISOString())
    if (selectedLocation?.lat && selectedLocation?.lng) {
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
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Ubicación */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium">Ubicación</label>
              <GooglePlacesAutocomplete
                placeholder="Distrito, dirección o lugar..."
                onPlaceSelect={handlePlaceSelect}
                value={locationQuery}
                onChange={setLocationQuery}
              />
            </div>

            {/* Deporte */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium">Deporte</label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger className="h-10">
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

            {/* Fecha */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium">Fecha</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal h-10 text-xs sm:text-sm", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{date ? format(date, "PPP", { locale: es }) : "Seleccionar fecha"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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

            {/* Hora */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-medium">Hora</label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="h-10">
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

          {/* Botón de búsqueda principal */}
          <div className="pt-1">
            <Button type="submit" size="lg" className="w-full gap-2 h-11 rounded-xl text-sm sm:text-base font-semibold shadow-md shadow-primary/20 hover:shadow-lg transition-all">
              <SearchIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Buscar Canchas Disponibles
            </Button>
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
