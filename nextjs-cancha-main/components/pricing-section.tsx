"use client"

import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

const plans = [
 
  {
    name: "Profesional",
    description: "Perfecto para clubes medianos con múltiples canchas",
    price: 120,
    features: [
      "Hasta 10 canchas",
      "2 sedes",
      "Sistema de reservas avanzado",
      "Promociones y descuentos",
      "Estadísticas detalladas",
      "Soporte prioritario",
      "Integración con pagos online",
    ],
    cta: "Probar 30 días gratis",
    popular: true,
  }
]

export function PricingSection() {
  return (
    <div className="container">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Planes y precios</h2>
        <p className="text-lg text-muted-foreground">
          Elige el plan que mejor se adapte a las necesidades de tu club deportivo.
        </p>
      </div>

      <div className="grid justify-center">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "flex flex-col",
              plan.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border shadow-md",
            )}
          >
            <CardHeader>
              {plan.popular && (
                <div className="mb-2 rounded-full bg-primary/10 px-3 py-1 text-center text-xs font-medium text-primary">
                  Más Popular
                </div>
              )}
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">S/{plan.price}</span>
                <span className="text-muted-foreground">/mes</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/register?type=club" className="w-full">
                <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                  {plan.cta}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground">
          ¿Necesitas un plan personalizado?{" "}
          <a href="https://wa.me/51959493759" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Contáctanos
          </a>
        </p>
      </div>
    </div>
  )
}

// Helper function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
