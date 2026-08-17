"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Datos de ejemplo
const data = [
  { name: "Enero", usuarios: 120, clubes: 8, reservas: 450 },
  { name: "Febrero", usuarios: 150, clubes: 10, reservas: 520 },
  { name: "Marzo", usuarios: 180, clubes: 12, reservas: 580 },
  { name: "Abril", usuarios: 220, clubes: 15, reservas: 650 },
  { name: "Mayo", usuarios: 280, clubes: 18, reservas: 720 },
  { name: "Junio", usuarios: 350, clubes: 22, reservas: 850 },
]

export function AdminStatsChart() {
  const [timeRange, setTimeRange] = useState("6m")

  // Filtrar datos según el rango de tiempo seleccionado
  const filteredData = timeRange === "3m" ? data.slice(-3) : timeRange === "6m" ? data : data

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
            <SelectItem value="12m">Último año</SelectItem>
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
