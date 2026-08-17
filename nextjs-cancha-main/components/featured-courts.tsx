"use client"

import { useState } from "react"
import Link from "next/link"
import { MapPinIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Datos de ejemplo
const featuredCourts = {
  futbol: [
    {
      id: 1,
      name: "Cancha de Fútbol 5",
      venue: "Club Deportivo Norte",
      location: "Av. Ejemplo 123, Zona Norte",
      price: 35,
      rating: 4.5,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Futbol+1",
    },
    {
      id: 2,
      name: "Cancha de Fútbol 7",
      venue: "Club Deportivo Sur",
      location: "Calle Sur 654, Zona Sur",
      price: 45,
      rating: 4.7,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Futbol+2",
    },
    {
      id: 3,
      name: "Cancha de Fútbol 11",
      venue: "Polideportivo Municipal",
      location: "Av. Central 321, Centro",
      price: 60,
      rating: 4.3,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Futbol+3",
    },
  ],
  tenis: [
    {
      id: 4,
      name: "Cancha de Tenis #3",
      venue: "Club Deportivo Central",
      location: "Calle Principal 456, Centro",
      price: 40,
      rating: 4.8,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Tenis+1",
    },
    {
      id: 5,
      name: "Cancha de Tenis #1",
      venue: "Club Deportivo Este",
      location: "Av. Del Este 789, Zona Este",
      price: 38,
      rating: 4.6,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Tenis+2",
    },
  ],
  padel: [
    {
      id: 6,
      name: "Cancha de Pádel #2",
      venue: "Club Deportivo Este",
      location: "Av. Del Este 789, Zona Este",
      price: 25,
      rating: 4.2,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Padel+1",
    },
    {
      id: 7,
      name: "Cancha de Pádel #1",
      venue: "Club Deportivo Norte",
      location: "Av. Ejemplo 123, Zona Norte",
      price: 28,
      rating: 4.4,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Padel+2",
    },
  ],
  basquet: [
    {
      id: 8,
      name: "Cancha de Básquet",
      venue: "Polideportivo Municipal",
      location: "Av. Central 321, Centro",
      price: 30,
      rating: 4.0,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Basquet+1",
    },
  ],
  voley: [
    {
      id: 9,
      name: "Cancha de Vóley",
      venue: "Club Deportivo Oeste",
      location: "Av. Oeste 987, Zona Oeste",
      price: 20,
      rating: 3.9,
      image: "/placeholder.svg?height=200&width=400&text=Cancha+Voley+1",
    },
  ],
}

export function FeaturedCourts() {
  const [activeTab, setActiveTab] = useState("futbol")

  return (
    <div className="space-y-6">
      <Tabs defaultValue="futbol" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="futbol">Fútbol</TabsTrigger>
            <TabsTrigger value="tenis">Tenis</TabsTrigger>
            <TabsTrigger value="padel">Pádel</TabsTrigger>
            <TabsTrigger value="basquet">Básquet</TabsTrigger>
            <TabsTrigger value="voley">Vóley</TabsTrigger>
          </TabsList>
        </div>

        {Object.entries(featuredCourts).map(([sport, courts]) => (
          <TabsContent key={sport} value={sport} className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courts.map((court) => (
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
                    <Link href={`/search?court=${court.id}`} className="w-full">
                      <Button className="w-full">Ver disponibilidad</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
