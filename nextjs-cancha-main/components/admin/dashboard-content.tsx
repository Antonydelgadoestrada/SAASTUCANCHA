"use client"

import { CalendarIcon, DollarSignIcon, TrendingUpIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminStatsChart } from "@/components/admin/stats-chart"
import { AdminRecentUsers } from "@/components/admin/recent-users"
import { AdminPendingRequests } from "@/components/admin/pending-requests"

export function AdminDashboardContent() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <section className="space-y-4">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard de Administrador</h2>
          <p className="text-muted-foreground">Bienvenido al panel de control de administrador.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+12.5% respecto al mes anterior</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clubes Activos</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-muted-foreground">+5.2% respecto al mes anterior</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$24,500</div>
              <p className="text-xs text-muted-foreground">+18.2% respecto al mes anterior</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservas Totales</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2,845</div>
              <p className="text-xs text-muted-foreground">+15.4% respecto al mes anterior</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Estadísticas Globales</CardTitle>
            <CardDescription>Usuarios, clubes y reservas en los últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <AdminStatsChart />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Usuarios Recientes</CardTitle>
                <CardDescription>Últimos usuarios registrados en la plataforma</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              <AdminRecentUsers />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Solicitudes Pendientes</CardTitle>
                <CardDescription>Clubes pendientes de aprobación</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Ver todas
              </Button>
            </CardHeader>
            <CardContent>
              <AdminPendingRequests />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
