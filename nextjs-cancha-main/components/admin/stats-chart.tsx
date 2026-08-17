"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Datos de fallback
const fallbackData = [
  { name: "Ene", usuarios: 12, clubes: 1, reservas: 15 },
  { name: "Feb", usuarios: 25, clubes: 2, reservas: 30 },
  { name: "Mar", usuarios: 45, clubes: 4, reservas: 55 },
  { name: "Abr", usuarios: 70, clubes: 6, reservas: 90 },
  { name: "May", usuarios: 110, clubes: 8, reservas: 140 },
  { name: "Jun", usuarios: 150, clubes: 10, reservas: 200 },
]

interface StatsChartProps {
  chartData?: any[]
}

export function AdminStatsChart({ chartData }: StatsChartProps) {
  const [timeRange, setTimeRange] = useState("6m")

  // Usar datos dinámicos si están disponibles, si no, el fallback
  const displayData = chartData && chartData.length > 0 ? chartData : fallbackData

  // Filtrar datos según el rango de tiempo seleccionado
  const filteredData = timeRange === "3m" ? displayData.slice(-3) : displayData

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
            <SelectItem value="6m">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filteredData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="usuarios" fill="hsl(var(--primary))" name="Usuarios" />
            <Bar dataKey="clubes" fill="hsl(var(--secondary))" name="Clubes" />
            <Bar dataKey="reservas" fill="hsl(var(--accent))" name="Reservas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
