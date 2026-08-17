"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
// Datos de ejemplo
interface ClubBookingsProps {
  data: any[]
}

export function ClubBookingsChart({data}:ClubBookingsProps) {

  return (
    <div className="space-y-4">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
            <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--secondary))" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="reservas" fill="#3b82f6" name="Reservas" />
<Bar yAxisId="right" dataKey="ingresos" fill="#10b981" name="Ingresos (S/)" />
{/* 
          */}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
