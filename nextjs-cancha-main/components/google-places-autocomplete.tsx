"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, MapPin, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useGoogleMaps } from "@/hooks/use-google-maps"

interface GooglePlacesAutocompleteProps {
  onPlaceSelect: (
    place: string,
    coordinates: { lat: number; lng: number }
  ) => void
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}

// Extrae texto completo de un lugar
function getFullText(place: google.maps.places.PlacePrediction): string {
  const extended = place as typeof place & { fullText?: { text: string } }
  return (
    extended.fullText?.text ??
    [place.mainText?.text, place.secondaryText?.text].filter(Boolean).join(", ")
  )
}

export function GooglePlacesAutocomplete({
  placeholder = "Busca canchas por distrito o dirección...",
  onPlaceSelect,
  value = "",
  onChange,
  className,
}: GooglePlacesAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<google.maps.places.AutocompleteSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const hasSelectedRef = useRef(false)
  const {
    searchSuggestions: searchPlaces,
    geocodePlace,
    isLoaded
  } = useGoogleMaps({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: ["places"],
  })

  // Manejo de cambios en el input
  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    onChange?.(value)
  }, [onChange])

  useEffect(() => {
    // ✅ Solo sincroniza si la prop `value` cambia y es distinta al estado `query`
    if (value && value !== query) {
      setQuery(value)
    }
  }, [value])
  
  // Selección de un lugar
  const handlePlaceSelect = useCallback(async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const place = suggestion.placePrediction
    if (!place) return

    const fullText = getFullText(place)
    if (!fullText) return
    hasSelectedRef.current = true
    setQuery(fullText)
    setShowResults(false)
    setIsSearching(true)
    try {
      const coords = await geocodePlace(place.placeId)
      onPlaceSelect(fullText, coords)
      onChange?.(fullText)
    } catch (err) {
      console.error("Error al obtener coordenadas:", err)
    } finally {
      setIsSearching(false)
    }
  }, [geocodePlace, onPlaceSelect, onChange])

  // Buscar lugares con debounce
  useEffect(() => {
    if (hasSelectedRef.current) {
      hasSelectedRef.current = false
      return
    }
    const timeoutId = setTimeout(async () => {
      if (query.trim().length > 2) {
        setIsSearching(true)
        try {
          const suggestions = await searchPlaces(query)
          setResults(suggestions)
          setShowResults(true)
        } catch (err) {
          console.error("Error buscando sugerencias:", err)
          setResults([])
        } finally {
          setIsSearching(false)
        }
      } else {
        setResults([])
        setShowResults(false)
      }
    }, 50)

    return () => clearTimeout(timeoutId)
  }, [query, searchPlaces])

  // Cierra sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Soporte para Enter/Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowResults(false)
      if (event.key === "Enter" && results.length > 0) {
        event.preventDefault()
        handlePlaceSelect(results[0])
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [results, handlePlaceSelect])

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="pl-10 pr-10"
          disabled={!isLoaded}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Lista de sugerencias */}
      {showResults && results.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto" ref={resultsRef}>
          <CardContent className="p-0">
            {results.map((suggestion) => {
              const place = suggestion.placePrediction
              if (!place || !place.mainText?.text) return null

              const mainText = place.mainText.text
              const secondaryText = place.secondaryText?.text ?? ""

              return (
                <button
                  key={place.placeId}
                  onClick={() => handlePlaceSelect(suggestion)}
                  className="w-full text-left p-3 hover:bg-muted transition-colors border-b last:border-b-0 flex items-start gap-3"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{mainText}</div>
                    <div className="text-xs text-muted-foreground truncate">{secondaryText}</div>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* No hay resultados */}
      {showResults && !isSearching && results.length === 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1">
          <CardContent className="p-3 text-center text-sm text-muted-foreground">
            No se encontraron resultados
          </CardContent>
        </Card>
      )}

      {/* Cargando Google Maps */}
      {!isLoaded && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <Card>
            <CardContent className="p-3 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Cargando Google Maps...
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
