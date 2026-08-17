// "use client"

// import { useState, useEffect } from "react"
// import Image from "next/image"
// import { ChevronLeft, ChevronRight, MapPinIcon } from "lucide-react"
// import { format } from "date-fns"
// import { es } from "date-fns/locale"

// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { PublicSearchForm } from "@/components/public-search-form"
// import { Badge } from "@/components/ui/badge"
// import { sportTypes } from "@/lib/sports"

// // Datos de ejemplo

// type CourtCard = {
//   id: number;
//   name: string;
//   venue: string;
//   district: string;
//   sport: string;
//   price: number;
//   rating: number;
//   images: string[];
//   description: string;
//   minimumBookingTime: string; // ej: "1", "1.5", "2"
// };
// // Generar horarios disponibles de ejemplo
// const generateAvailableSlots = (date: Date) => {
//   const slots = []
//   const baseHours = [8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20]

//   // Aleatoriamente eliminar algunos horarios para simular ocupación
//   const availableHours = baseHours.filter(() => Math.random() > 0.3)

//   for (const hour of availableHours) {
//     slots.push({
//       time: `${hour}:00`,
//       date: new Date(date.setHours(hour, 0, 0, 0)),
//     })
//   }

//   return slots
// }

// const districts = [
//   { value: "sanisidro", label: "San Isidro" },
//   { value: "miraflores", label: "Miraflores" },
//   { value: "surco", label: "Surco" },
//   { value: "lamolina", label: "Lamolina" },
//   { value: "chorrillos", label: "Chorrillos" },
// ]

// interface SearchResultsProps {
//   sport?: string
//   district?: string
//   date?: Date
//   courtId?: number
//   query?: string
// }

// export function SearchResults({ sport, district, date = new Date(), courtId, query }: SearchResultsProps) {
//   const [view, setView] = useState<"list" | "map">("list")
//   const [sortBy, setSortBy] = useState<string>("recommended")
//   const [filteredCourts, setFilteredCourts] = useState<CourtCard[]>([])
//   const [selectedCourt, setSelectedCourt] = useState<(CourtCard[])[0] | null>(null)
//   const [availableSlots, setAvailableSlots] = useState<{ time: string; date: Date }[]>([])
//   const [currentImageIndex, setCurrentImageIndex] = useState(0)

//   useEffect(() => {
//     // Filtrar canchas según los parámetros de búsqueda
//     let filtered = []

//     if (courtId) {
//       filtered = filtered.filter((court) => court.id === courtId)
//       if (filtered.length > 0) {
//         setSelectedCourt(filtered[0])
//         setAvailableSlots(generateAvailableSlots(date || new Date()))
//         setCurrentImageIndex(0)
//       }
//     } else {
//       if (sport) {
//         filtered = filtered.filter((court) => court.sport === sport)
//       }

//       if (district) {
//         filtered = filtered.filter((court) => court.district === district)
//       }

//       if (query) {
//         const lowerQuery = query.toLowerCase()
//         filtered = filtered.filter(
//           (court) =>
//             court.name.toLowerCase().includes(lowerQuery) ||
//             court.venue.toLowerCase().includes(lowerQuery) ||
//             court.description.toLowerCase().includes(lowerQuery),
//         )
//       }
//     }

//     // Ordenar resultados
//     if (sortBy === "price_asc") {
//       filtered.sort((a, b) => a.price - b.price)
//     } else if (sortBy === "price_desc") {
//       filtered.sort((a, b) => b.price - a.price)
//     } else if (sortBy === "rating") {
//       filtered.sort((a, b) => b.rating - a.rating)
//     }

//     setFilteredCourts(filtered)
//   }, [sport, district, date, courtId, sortBy, query])

//   const handleCourtSelect = (court: (typeof allCourts)[0]) => {
//     setSelectedCourt(court)
//     setAvailableSlots(generateAvailableSlots(date || new Date()))
//     setCurrentImageIndex(0)
//   }

//   const nextImage = () => {
//     if (selectedCourt) {
//       setCurrentImageIndex((prev) => (prev + 1) % selectedCourt.images.length)
//     }
//   }

//   const prevImage = () => {
//     if (selectedCourt) {
//       setCurrentImageIndex((prev) => (prev - 1 + selectedCourt.images.length) % selectedCourt.images.length)
//     }
//   }

//   return (
//     <div className="space-y-8">
//       {!courtId && (
//         <Card className="mb-8">
//           <CardHeader>
//             <CardTitle>Refinar búsqueda</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <PublicSearchForm />
//           </CardContent>
//         </Card>
//       )}

//       {selectedCourt ? (
//         <div className="space-y-6">
//           <div className="flex items-center justify-between">
//             <Button variant="ghost" onClick={() => setSelectedCourt(null)}>
//               ← Volver a resultados
//             </Button>
//             <div className="text-sm text-muted-foreground">
//               {date && format(date, "EEEE d 'de' MMMM, yyyy", { locale: es })}
//             </div>
//           </div>

//           <Card className="overflow-hidden">
//             {/* Carrusel de imágenes */}
//             <div className="relative aspect-video w-full overflow-hidden md:aspect-[21/9]">
//               <Image
//                 src={selectedCourt.images[currentImageIndex] || "/placeholder.svg"}
//                 alt={`${selectedCourt.name} - Imagen ${currentImageIndex + 1}`}
//                 width={800}
//                 height={400}
//                 className="h-full w-full object-cover"
//               />

//               {selectedCourt.images.length > 1 && (
//                 <>
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80 text-foreground"
//                     onClick={prevImage}
//                   >
//                     <ChevronLeft className="h-6 w-6" />
//                   </Button>
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80 text-foreground"
//                     onClick={nextImage}
//                   >
//                     <ChevronRight className="h-6 w-6" />
//                   </Button>
//                   <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
//                     {selectedCourt.images.map((_, index) => (
//                       <button
//                         key={index}
//                         className={`h-2 w-2 rounded-full ${
//                           index === currentImageIndex ? "bg-primary" : "bg-background/80"
//                         }`}
//                         onClick={() => setCurrentImageIndex(index)}
//                       />
//                     ))}
//                   </div>
//                 </>
//               )}
//             </div>

//             <CardHeader>
//               <div className="flex items-start justify-between">
//                 <div>
//                   <CardTitle className="text-2xl">{selectedCourt.name}</CardTitle>
//                   <CardDescription className="flex items-center text-base">
//                     <MapPinIcon className="mr-1 h-4 w-4" />
//                     {selectedCourt.venue} -{" "}
//                     {district && districts.find((d) => d.value === selectedCourt.district)?.label}
//                   </CardDescription>
//                 </div>
//                 <Badge variant="outline" className="bg-primary/10 text-primary">
//                   {sportTypes.find((s) => s.value === selectedCourt.sport)?.label}
//                 </Badge>
//               </div>
//             </CardHeader>

//             <CardContent className="space-y-6">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <div className="text-lg font-medium">${selectedCourt.price}/hora</div>
//                   <div className="text-sm text-muted-foreground">Precio por hora</div>
//                 </div>
//                 <div className="flex items-center">
//                   <div className="flex items-center space-x-1">
//                     {Array(5)
//                       .fill(null)
//                       .map((_, i) => (
//                         <svg
//                           key={i}
//                           className={`h-5 w-5 ${i < Math.floor(selectedCourt.rating) ? "fill-primary" : "fill-muted"}`}
//                           xmlns="http://www.w3.org/2000/svg"
//                           viewBox="0 0 24 24"
//                         >
//                           <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
//                         </svg>
//                       ))}
//                     <span className="ml-1 text-sm font-medium">{selectedCourt.rating}</span>
//                   </div>
//                 </div>
//               </div>

//               <div>
//                 <h3 className="mb-2 text-lg font-medium">Descripción</h3>
//                 <p className="text-muted-foreground">{selectedCourt.description}</p>
//               </div>

//               <div>
//                 <span>{}</span>
//                 <h3 className="mb-4 text-lg font-medium">Horarios disponibles</h3>
//                 {availableSlots.length > 0 ? (
//                   <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
//                     {availableSlots.map((slot, index) => (
//                       <Button key={index} variant="outline" className="h-auto flex-col py-2">
//                         <span>{slot.time}</span>
//                         <span className="text-xs text-muted-foreground">Disponible</span>
//                       </Button>
//                     ))}
//                   </div>
//                 ) : (
//                   <p className="text-muted-foreground">No hay horarios disponibles para esta fecha.</p>
//                 )}
//               </div>

//               <div className="pt-4">
//                 <Button className="w-full" size="lg" disabled={availableSlots.length === 0}>
//                   {availableSlots.length > 0 ? "Reservar Ahora" : "No hay disponibilidad"}
//                 </Button>
//                 <p className="mt-2 text-center text-sm text-muted-foreground">
//                   Debes iniciar sesión para completar la reserva
//                 </p>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       ) : (
//         <>
//           <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
//             <div>
//               <h2 className="text-xl font-semibold">
//                 {filteredCourts.length} {filteredCourts.length === 1 ? "resultado" : "resultados"} encontrados
//               </h2>
//               <div className="mt-2 flex flex-wrap gap-2">
//                 {sport && (
//                   <Badge variant="secondary" className="flex items-center gap-1">
//                     Deporte: {sportTypes.find((s) => s.value === sport)?.label}
//                   </Badge>
//                 )}
//                 {district && (
//                   <Badge variant="secondary" className="flex items-center gap-1">
//                     Distrito: {districts.find((d) => d.value === district)?.label}
//                   </Badge>
//                 )}
//                 {query && (
//                   <Badge variant="secondary" className="flex items-center gap-1">
//                     Búsqueda: {query}
//                   </Badge>
//                 )}
//               </div>
//             </div>
//             <div className="flex items-center gap-4">
//               <div className="flex items-center gap-2">
//                 <Select value={sortBy} onValueChange={setSortBy}>
//                   <SelectTrigger className="w-[180px]">
//                     <SelectValue placeholder="Ordenar por" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="recommended">Recomendados</SelectItem>
//                     <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
//                     <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
//                     <SelectItem value="rating">Mejor valorados</SelectItem>
//                   </SelectContent>
//                 </Select>
//               </div>
//               <Tabs value={view} onValueChange={(v) => setView(v as "list" | "map")}>
//                 <TabsList>
//                   <TabsTrigger value="list">Lista</TabsTrigger>
//                   <TabsTrigger value="map">Mapa</TabsTrigger>
//                 </TabsList>
//               </Tabs>
//             </div>
//           </div>

//           <Tabs value={view} className="w-full">
//             <TabsContent value="list" className="mt-0">
//               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
//                 {filteredCourts.map((court) => (
//                   <Card key={court.id} className="overflow-hidden">
//                     <div className="relative aspect-video w-full overflow-hidden">
//                       <Image
//                         src={court.images[0] || "/placeholder.svg"}
//                         alt={court.name}
//                         width={400}
//                         height={225}
//                         className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
//                       />
//                       <Badge className="absolute right-2 top-2 bg-background/80 text-foreground">
//                         {sportTypes.find((s) => s.value === court.sport)?.label}
//                       </Badge>
//                     </div>
//                     <CardHeader>
//                       <CardTitle>{court.name}</CardTitle>
//                       <CardDescription>{court.venue}</CardDescription>
//                     </CardHeader>
//                     <CardContent>
//                       <div className="flex items-center text-sm text-muted-foreground">
//                         <MapPinIcon className="mr-1 h-4 w-4" />
//                         <span>{districts.find((d) => d.value === court.district)?.label}</span>
//                       </div>
//                       <div className="mt-2 flex items-center justify-between">
//                         <span className="font-medium">${court.price}/hora</span>
//                         <div className="flex items-center space-x-1">
//                           {Array(5)
//                             .fill(null)
//                             .map((_, i) => (
//                               <svg
//                                 key={i}
//                                 className={`h-4 w-4 ${i < Math.floor(court.rating) ? "fill-primary" : "fill-muted"}`}
//                                 xmlns="http://www.w3.org/2000/svg"
//                                 viewBox="0 0 24 24"
//                               >
//                                 <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
//                               </svg>
//                             ))}
//                           <span className="ml-1 text-xs text-muted-foreground">{court.rating}</span>
//                         </div>
//                       </div>
//                     </CardContent>
//                     <CardFooter>
//                       <Button className="w-full" onClick={() => handleCourtSelect(court)}>
//                         Ver disponibilidad
//                       </Button>
//                     </CardFooter>
//                   </Card>
//                 ))}
//               </div>
//             </TabsContent>
//             <TabsContent value="map" className="mt-0">
//               <Card className="overflow-hidden">
//                 <div className="aspect-[21/9] w-full bg-muted">
//                   <div className="flex h-full items-center justify-center">
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="currentColor"
//                       strokeWidth="2"
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       className="h-16 w-16 text-muted-foreground"
//                     >
//                       <circle cx="12" cy="12" r="10" />
//                       <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
//                       <path d="M2 12h20" />
//                     </svg>
//                     <span className="sr-only">Mapa interactivo</span>
//                   </div>
//                 </div>
//                 <CardContent className="p-6">
//                   <p className="text-center text-muted-foreground">
//                     Mapa interactivo con ubicación de canchas disponibles
//                   </p>
//                 </CardContent>
//               </Card>
//             </TabsContent>
//           </Tabs>
//         </>
//       )}
//     </div>
//   )
// }
