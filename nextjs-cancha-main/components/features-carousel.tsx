"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Calendar, Shield, Search, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const featuresData = [
  {
    tag: "Control Total de Horarios",
    tagIcon: <Calendar className="h-4.5 w-4.5" />,
    title: "Gestión Inteligente de Reservas y Múltiples Sedes",
    desc: "Olvídate de las reservas duplicadas y de los cuadernos de papel. Nuestro calendario dinámico permite coordinar turnos en tiempo real, admitir reservas virtuales e incluso gestionar múltiples locales deportivos desde un solo lugar.",
    bullets: [
      "Bloqueo y liberación de slots en tiempo real.",
      "Configuración flexible de múltiples canchas y deportes.",
      "Resolución virtual de disponibilidad sin sobrecargar tu base de datos."
    ],
    image: "/booking_dashboard_mockup.jpg",
    alt: "Calendario Inteligente de Reservas"
  },
  {
    tag: "Transacciones Protegidas",
    tagIcon: <Shield className="h-4.5 w-4.5" />,
    title: "Pasarela de Pago Segura y Promociones Dinámicas",
    desc: "Ofrece a tus clientes la facilidad de pagar online a través de Mercado Pago de manera instantánea o separar su cancha con un pago parcial. Adicionalmente, atrae más jugadores configurando descuentos y promociones en horarios específicos.",
    bullets: [
      "Integración directa y segura con Mercado Pago.",
      "Tarifas diferenciadas (diurna/nocturna) automáticas.",
      "Códigos de descuento personalizados para tus clientes habituales."
    ],
    image: "/payment_checkout_mockup.jpg",
    alt: "Checkout de Pago Seguro"
  },
  {
    tag: "Visibilidad y Crecimiento",
    tagIcon: <Search className="h-4.5 w-4.5" />,
    title: "Buscador para Deportistas y Analíticas de Negocio",
    desc: "Permite que miles de jugadores te encuentren fácilmente gracias a nuestro mapa interactivo y geolocalizado. Al mismo tiempo, obtén reportes detallados del rendimiento mensual de tus canchas, tasas de ocupación e ingresos generados.",
    bullets: [
      "Búsqueda avanzada por deporte, ubicación y hora exacta.",
      "Panel de administración con gráficos interactivos de crecimiento.",
      "Control detallado de reservas aceptadas y canceladas."
    ],
    image: "/search_stats_mockup.jpg",
    alt: "Buscador y Estadísticas Detalladas"
  }
]

export function FeaturesCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Auto-play interval
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext()
    }, 6000) // 6 seconds auto-play

    return () => clearInterval(timer)
  }, [activeIndex])

  const handleNext = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % featuresData.length)
      setIsAnimating(false)
    }, 200)
  }

  const handlePrev = () => {
    setIsAnimating(true)
    setTimeout(() => {
      setActiveIndex((prev) => (prev - 1 + featuresData.length) % featuresData.length)
      setIsAnimating(false)
    }, 200)
  }

  const handleDotClick = (index: number) => {
    setIsAnimating(true)
    setTimeout(() => {
      setActiveIndex(index)
      setIsAnimating(false)
    }, 200)
  }

  const currentFeature = featuresData[activeIndex]

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 md:px-8">
      {/* Active slide layout */}
      <div className={`grid gap-12 lg:grid-cols-12 lg:items-center min-h-[400px] transition-all duration-300 ${isAnimating ? "opacity-30 scale-[0.99]" : "opacity-100 scale-100"}`}>
        {/* Content Side */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            {currentFeature.tagIcon}
            {currentFeature.tag}
          </div>
          <h3 className="text-2xl font-bold sm:text-3xl tracking-tight text-foreground transition-all">
            {currentFeature.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {currentFeature.desc}
          </p>
          <ul className="space-y-3.5 text-sm font-medium text-muted-foreground">
            {currentFeature.bullets.map((bullet, i) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image Side */}
        <div className="lg:col-span-6 relative">
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-border shadow-2xl bg-muted group">
            <Image
              src={currentFeature.image}
              alt={currentFeature.alt}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-12 pt-8 border-t border-border/40">
        {/* Dots indicators */}
        <div className="flex gap-2.5">
          {featuresData.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleDotClick(index)}
              className={`h-3 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-8 bg-primary" : "w-3 bg-muted hover:bg-muted-foreground/40"
              }`}
              aria-label={`Ir al slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Action Arrows */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Anterior característica"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
            aria-label="Siguiente característica"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
