"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader, Library } from "@googlemaps/js-api-loader"

export interface PlaceSuggestionItem {
  id: string
  mainText: string
  secondaryText: string
  fullText: string
  placeId?: string
  coordinates?: { lat: number; lng: number }
}

interface GoogleMapsConfig {
  apiKey?: string
  libraries?: Library[]
}

export function useGoogleMaps(config: GoogleMapsConfig = {}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const autocompleteSessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  const apiKey = config.apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

  useEffect(() => {
    let isMounted = true

    const loadMaps = async () => {
      if (!apiKey) {
        if (isMounted) setIsLoaded(true)
        return
      }

      try {
        const loader = new Loader({
          apiKey,
          libraries: config.libraries ?? ["places"],
        })

        await loader.load()

        if (isMounted && typeof window !== "undefined" && window.google?.maps) {
          geocoderRef.current = new window.google.maps.Geocoder()
          if (window.google.maps.places) {
            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
            autocompleteSessionToken.current = new window.google.maps.places.AutocompleteSessionToken()
          }
          setIsLoaded(true)
        }
      } catch (err) {
        console.warn("⚠️ Error cargando Google Maps API, usando geocodificador de respaldo:", err)
        if (isMounted) setIsLoaded(true)
      }
    }

    loadMaps()

    return () => {
      isMounted = false
    }
  }, [apiKey])

  /**
   * Búsqueda de respaldo usando Nominatim / OpenStreetMap
   */
  const searchFallback = useCallback(async (query: string): Promise<PlaceSuggestionItem[]> => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=pe&limit=6&addressdetails=1`
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'es-PE,es;q=0.9',
        },
      })

      if (!res.ok) return []
      const data = await res.json()

      return (data || []).map((item: any) => {
        const parts = (item.display_name || '').split(',')
        const mainText = parts[0]?.trim() || item.name || query
        const secondaryText = parts.slice(1, 4).join(',').trim()

        return {
          id: String(item.osm_id || item.place_id || Math.random()),
          mainText,
          secondaryText,
          fullText: item.display_name,
          coordinates: {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          },
        }
      })
    } catch (fallbackError) {
      console.error("❌ Error en búsqueda de respaldo:", fallbackError)
      return []
    }
  }, [])

  /**
   * Búsqueda de sugerencias (Google Maps AutocompleteService con fallback a OSM)
   */
  const searchSuggestions = useCallback(
    async (query: string): Promise<PlaceSuggestionItem[]> => {
      if (!query || query.trim().length < 2) return []

      // 1. Intentar con Google Places si está disponible
      if (autocompleteServiceRef.current && typeof window !== "undefined" && window.google?.maps?.places) {
        try {
          const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
            autocompleteServiceRef.current!.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: "pe" },
                sessionToken: autocompleteSessionToken.current || undefined,
              },
              (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                  resolve(results)
                } else {
                  resolve([])
                }
              }
            )
          })

          if (predictions.length > 0) {
            return predictions.map((p) => ({
              id: p.place_id,
              placeId: p.place_id,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text || "",
              fullText: p.description,
            }))
          }
        } catch (gError) {
          console.warn("⚠️ Error en Google Places Autocomplete, pasando a fallback:", gError)
        }
      }

      // 2. Si Google Maps no devolvió resultados o no está activo, usar búsqueda de respaldo
      return searchFallback(query)
    },
    [searchFallback]
  )

  /**
   * Geocodificar un lugar para obtener latitud y longitud
   */
  const geocodePlace = useCallback(
    async (placeIdOrAddress: string, fallbackCoords?: { lat: number; lng: number }): Promise<{ lat: number; lng: number }> => {
      if (fallbackCoords && !isNaN(fallbackCoords.lat) && !isNaN(fallbackCoords.lng)) {
        return fallbackCoords
      }

      // 1. Intentar con Google Geocoder
      if (geocoderRef.current && typeof window !== "undefined" && window.google?.maps) {
        try {
          const req = placeIdOrAddress.startsWith("ChIJ") || placeIdOrAddress.length > 25
            ? { placeId: placeIdOrAddress }
            : { address: placeIdOrAddress, componentRestrictions: { country: "pe" } }

          const result = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
            geocoderRef.current!.geocode(req, (results, status) => {
              if (status === window.google.maps.GeocoderStatus.OK && results?.[0]?.geometry?.location) {
                const loc = results[0].geometry.location
                resolve({ lat: loc.lat(), lng: loc.lng() })
              } else {
                reject(new Error(status))
              }
            })
          })

          return result
        } catch (gErr) {
          console.warn("⚠️ Error en Google Geocoder, usando geocodificación OSM:", gErr)
        }
      }

      // 2. Fallback con Nominatim Geocoding
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeIdOrAddress)}&countrycodes=pe&limit=1`
        const res = await fetch(url, { headers: { 'Accept-Language': 'es-PE,es;q=0.9' } })
        if (res.ok) {
          const data = await res.json()
          if (data && data[0]) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
          }
        }
      } catch (fErr) {
        console.error("❌ Falló geocodificación de respaldo:", fErr)
      }

      // Ubicación por defecto de Lima, Perú
      return { lat: -12.046374, lng: -77.042793 }
    },
    []
  )

  return {
    isLoaded,
    searchSuggestions,
    geocodePlace,
  }
}
