"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, MapPin, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useGoogleMaps, PlaceSuggestionItem } from "@/hooks/use-google-maps"

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

export function GooglePlacesAutocomplete({
  placeholder = "Busca canchas por distrito o dirección...",
  onPlaceSelect,
  value = "",
  onChange,
  className = "",
}: GooglePlacesAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<PlaceSuggestionItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const hasSelectedRef = useRef(false)

  const { searchSuggestions, geocodePlace } = useGoogleMaps({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: ["places"],
  })

  // Manejo de cambios en el input
  const handleInputChange = useCallback((val: string) => {
    setQuery(val)
    onChange?.(val)
  }, [onChange])

  useEffect(() => {
    if (value !== undefined && value !== query && !hasSelectedRef.current) {
      setQuery(value)
    }
  }, [value])

  // Selección de un lugar
  const handlePlaceSelect = useCallback(async (suggestion: PlaceSuggestionItem) => {
    hasSelectedRef.current = true
    const selectedText = suggestion.fullText || suggestion.mainText
    setQuery(selectedText)
    setShowResults(false)
    setIsSearching(true)

    try {
      const coords = await geocodePlace(suggestion.placeId || selectedText, suggestion.coordinates)
      onPlaceSelect(selectedText, coords)
      onChange?.(selectedText)
    } catch (err) {
      console.error("Error al obtener coordenadas:", err)
      if (suggestion.coordinates) {
        onPlaceSelect(selectedText, suggestion.coordinates)
      }
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

    if (!query || query.trim().length < 2) {
      setResults([])
      setShowResults(false)
      setIsSearching(false)
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const suggestions = await searchSuggestions(query)
        setResults(suggestions)
        setShowResults(suggestions.length > 0)
      } catch (err) {
        console.error("Error buscando sugerencias:", err)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timeoutId)
  }, [query, searchSuggestions])

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

  // Soporte para teclado (Escape / Enter)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowResults(false)
      if (event.key === "Enter" && showResults && results.length > 0) {
        event.preventDefault()
        handlePlaceSelect(results[0])
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [results, showResults, handlePlaceSelect])

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onFocus={() => {
            if (results.length > 0) setShowResults(true)
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          className="pl-9 pr-10 h-10 w-full"
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              onChange?.("")
              setResults([])
              setShowResults(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Lista desplegable de sugerencias */}
      {showResults && results.length > 0 && (
        <Card
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto shadow-lg border border-border bg-popover text-popover-foreground rounded-lg"
          ref={resultsRef}
        >
          <CardContent className="p-1">
            {results.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handlePlaceSelect(suggestion)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/80 focus:bg-muted/80 rounded-md transition-colors flex items-start gap-2.5 cursor-pointer outline-none"
              >
                <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {suggestion.mainText}
                  </div>
                  {suggestion.secondaryText && (
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestion.secondaryText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
