"use client"

import { BarChart3Icon } from "lucide-react"

import { Progress } from "@/components/ui/progress"
export const formatSoles = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
// Datos de ejemplo
interface ReservationFormProps {
  popularCourts: any[]
}

export function ClubPopularCourts({popularCourts}:ReservationFormProps) {
  return (
    <div className="space-y-8">
      {popularCourts.map((court) => (
        <div key={court.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium leading-none">{court.name}</p>
              <p className="text-sm text-muted-foreground">
                {court.bookings} reservas - {formatSoles(court.revenue)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{court.occupancyRate}%</span>
            </div>
          </div>
          <Progress value={court.occupancyRate} className="h-2" />
        </div>
      ))}
    </div>
  )
}
