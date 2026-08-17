// "use client"

// import type React from "react"

// import { useState, useRef } from "react"
// import { MapPin, Navigation, Loader2 } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
// import { useGoogleMaps } from "@/hooks/use-google-maps"

// interface LocationPickerProps {
//   onLocationSelect: (location: { lat: number; lng: number}, address:string) => void
//   initialLocation?: { lat: number; lng: number }
// }

// export function LocationPicker({ onLocationSelect, initialLocation }: LocationPickerProps) {
//   const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null)
//   const [isGettingLocation, setIsGettingLocation] = useState(false)
//   const mapRef = useRef<HTMLDivElement>(null)

//   const { isLoaded } = useGoogleMaps({
//     apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
//     libraries: ["places"],
//   })

//   // Ubicación por defecto (Lima, Perú)
//   const defaultLocation = { lat: -12.0464, lng: -77.0428 }

//   const handlePlaceSelect = (place: any, coordinates: { lat: number; lng: number }) => {
//     setSelectedLocation(coordinates)
//     onLocationSelect(coordinates, place)
//   }

//   const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
//     const rect = event.currentTarget.getBoundingClientRect()
//     const x = event.clientX - rect.left
//     const y = event.clientY - rect.top

//     // Convertir coordenadas del click a lat/lng (simulado)
//     // En producción usarías la API de Google Maps
//     const lat = defaultLocation.lat + (y - rect.height / 2) * 0.001
//     const lng = defaultLocation.lng + (x - rect.width / 2) * 0.001

//     const newLocation = { lat, lng }
//     setSelectedLocation(newLocation)
//     onLocationSelect(newLocation)
//   }

//   const getCurrentLocation = () => {
//     setIsGettingLocation(true)

//     if (navigator.geolocation) {
//       navigator.geolocation.getCurrentPosition(
//         (position) => {
//           const location = {
//             lat: position.coords.latitude,
//             lng: position.coords.longitude,
//           }
//           setSelectedLocation(location)
//           onLocationSelect(location)
//           setIsGettingLocation(false)
//         },
//         (error) => {
//           console.error("Error obteniendo ubicación:", error)
//           // Usar ubicación por defecto
//           setSelectedLocation(defaultLocation)
//           onLocationSelect(defaultLocation)
//           setIsGettingLocation(false)
//         },
//       )
//     } else {
//       setIsGettingLocation(false)
//     }
//   }

//   return (
//     <div className="space-y-4">
//       {/* Buscador de lugares con Google Places */}
//       <GooglePlacesAutocomplete 
      
//       placeholder="Buscar dirección exacta del club..." onPlaceSelect={handlePlaceSelect} />

//       {/* Botón para obtener ubicación actual */}
//       <Button
//         type="button"
//         variant="outline"
//         onClick={getCurrentLocation}
//         disabled={isGettingLocation}
//         className="w-full"
//       >
//         {isGettingLocation ? (
//           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//         ) : (
//           <Navigation className="mr-2 h-4 w-4" />
//         )}
//         {isGettingLocation ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
//       </Button>

//       {/* Mapa interactivo */}
//       <div className="relative">
//         <div
//           ref={mapRef}
//           onClick={handleMapClick}
//           className="w-full h-64 bg-gradient-to-br from-green-100 to-blue-100 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-crosshair relative overflow-hidden"
//           style={{
//             backgroundImage: `
//               radial-gradient(circle at 20% 20%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
//               radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
//               radial-gradient(circle at 40% 40%, rgba(120, 219, 226, 0.1) 0%, transparent 50%)
//             `,
//           }}
//         >
//           {/* Indicador de ubicación seleccionada */}
//           {selectedLocation && (
//             <div
//               className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
//               style={{
//                 left: `${50 + (selectedLocation.lng - defaultLocation.lng) * 1000}%`,
//                 top: `${50 - (selectedLocation.lat - defaultLocation.lat) * 1000}%`,
//               }}
//             >
//               <div className="bg-red-500 rounded-full p-2 shadow-lg animate-bounce">
//                 <MapPin className="h-4 w-4 text-white" />
//               </div>
//             </div>
//           )}

//           {/* Overlay con instrucciones */}
//           <div className="absolute inset-0 flex items-center justify-center">
//             <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 text-center shadow-lg max-w-xs">
//               <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
//               <p className="text-sm font-medium">Selecciona la ubicación exacta</p>
//               <p className="text-xs text-muted-foreground mt-1">Busca una dirección arriba o haz clic en el mapa</p>
//               {!isLoaded && (
//                 <div className="flex items-center justify-center gap-2 mt-2">
//                   <Loader2 className="h-3 w-3 animate-spin" />
//                   <span className="text-xs">Cargando Google Maps...</span>
//                 </div>
//               )}
//             </div>
//           </div>

//           {/* Grid de referencia */}
//           <div className="absolute inset-0 opacity-10">
//             <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
//               {Array.from({ length: 48 }).map((_, i) => (
//                 <div key={i} className="border border-gray-400" />
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Información de ubicación seleccionada */}
//       {selectedLocation && (
//         <div className="bg-muted p-3 rounded-lg">
//           <div className="flex items-center gap-2 mb-2">
//             <MapPin className="h-4 w-4 text-green-600" />
//             <span className="font-medium text-sm">Ubicación seleccionada</span>
//           </div>
//           <div className="text-sm text-muted-foreground">Latitud: {selectedLocation.lat.toFixed(6)}</div>
//           <div className="text-sm text-muted-foreground">Longitud: {selectedLocation.lng.toFixed(6)}</div>
//           <div className="text-xs text-muted-foreground mt-1">
//             Esta ubicación se guardará con tu club para que los usuarios puedan encontrarte fácilmente
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }
