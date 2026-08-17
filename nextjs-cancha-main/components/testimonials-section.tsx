"use client"

import Image from "next/image"
import { ChevronLeftIcon, ChevronRightIcon, Quote } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Datos de ejemplo
const testimonials = [
  {
    id: 1,
    name: "Carlos Rodríguez",
    role: "Gerente de Club Deportivo Norte",
    content:
      `${process.env.NEXT_PUBLIC_APP_NAME} ha transformado la forma en que gestionamos nuestras canchas. Hemos aumentado nuestras reservas en un 40% y reducido el trabajo administrativo significativamente.`,
    image: "/recomendacion-01.jpeg?height=80&width=80&text=CR",
  },
  {
    id: 2,
    name: "Juan Pérez",
    role: "Directora de Polideportivo Municipal",
    content:
      `Desde que implementamos ${process.env.NEXT_PUBLIC_APP_NAME}, la gestión de nuestras instalaciones es mucho más eficiente. Los clientes están encantados con la facilidad para reservar online.`,
    image: "/recomendacion-02.jpeg?height=80&width=80&text=ML",
  },
  {
    id: 3,
    name: "María López",
    role: "Propietario de Club de Tenis",
    content:
      "La plataforma es intuitiva y fácil de usar. El soporte al cliente es excelente y siempre están dispuestos a ayudar con cualquier consulta.",
    image: "/recomendacion-03.jpeg?height=80&width=80&text=JP",
  },
  {
    id: 4,
    name: "Eduardo Monzon",
    role: "Administradora de Centro Deportivo",
    content:
      `${process.env.NEXT_PUBLIC_APP_NAME} nos ha permitido optimizar la ocupación de nuestras canchas y aumentar nuestros ingresos. La herramienta de promociones es especialmente útil.`,
    image: "/recomendacion-04.jpeg?height=80&width=80&text=AM",
  },
]

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length)
  }

  // Mostrar 1 testimonio en móvil, 2 en tablet, 3 en desktop
  const visibleTestimonials = () => {
    const result = []
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % testimonials.length
      result.push(testimonials[index])
    }
    return result
  }

  return (
    <div className="container">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Lo que dicen nuestros clientes</h2>
        <p className="text-lg text-muted-foreground">
          Descubre por qué cientos de clubes deportivos confían en {process.env.NEXT_PUBLIC_APP_NAME} para gestionar sus canchas.
        </p>
      </div>

      <div className="relative">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleTestimonials().map((testimonial, index) => (
            <Card
              key={`${testimonial.id}-${index}`}
              className={cn(
                "border-none shadow-md",
                index > 0 ? "hidden md:block" : "",
                index > 1 ? "md:hidden lg:block" : "",
              )}
            >
              <CardContent className="flex flex-col gap-4 p-6">
                <Quote className="h-8 w-8 text-primary/40" />
                <p className="text-lg">{testimonial.content}</p>
                <div className="mt-4 flex items-center gap-4">
                  <Image
                    src={testimonial.image || "/placeholder.svg"}
                    alt={testimonial.name}
                    width={50}
                    height={50}
                    className="rounded-full"
                  />
                  <div>
                    <h4 className="font-medium">{testimonial.name}</h4>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" size="icon" onClick={prevTestimonial}>
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="sr-only">Anterior</span>
          </Button>
          <Button variant="outline" size="icon" onClick={nextTestimonial}>
            <ChevronRightIcon className="h-4 w-4" />
            <span className="sr-only">Siguiente</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
