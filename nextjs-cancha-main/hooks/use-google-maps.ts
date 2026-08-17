"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader, Library } from "@googlemaps/js-api-loader"

interface GoogleMapsConfig {
  apiKey: string
  libraries?: Library[]
}

export function useGoogleMaps(config: GoogleMapsConfig) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null)
  const autocompleteSessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  useEffect(() => {
    const load = async () => {
      const loader = new Loader({
        apiKey: config.apiKey,
        libraries: config.libraries ?? ["places"],
      })

      await loader.load()

      setGeocoder(new google.maps.Geocoder())
      autocompleteSessionToken.current = new google.maps.places.AutocompleteSessionToken()
      setIsLoaded(true)
    }

    load().catch((err) => {
      console.error("❌ Error cargando Google Maps:", err)
    })
  }, [config.apiKey])

  const searchSuggestions = useCallback(async (query: string): Promise<google.maps.places.AutocompleteSuggestion[]> => {
    try {
      const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary

      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: autocompleteSessionToken.current!,
      })

      return suggestions
    } catch (error) {
      console.error("❌ Error buscando sugerencias:", error)
      return []
    }
  }, [])

  const geocodePlace = useCallback(
    async (placeId: string): Promise<{ lat: number; lng: number }> => {
      if (!geocoder) throw new Error("Geocoder no inicializado")

      return new Promise((resolve, reject) => {
        geocoder.geocode({ placeId }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            const location = results[0].geometry.location
            resolve({ lat: location.lat(), lng: location.lng() })
          } else {
            reject(new Error(`Error geocodificando: ${status}`))
          }
        })
      })
    },
    [geocoder]
  )

  return {
    isLoaded,
    searchSuggestions,
    geocodePlace,
  }
}
