"use client"

import { useEffect, useState } from "react"
import { CalendarIcon, DollarSignIcon, TrendingUpIcon, UsersIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminStatsChart } from "@/components/admin/stats-chart"
import { AdminRecentUsers } from "@/components/admin/recent-users"
import { AdminPendingRequests } from "@/components/admin/pending-requests"
import { getAdminDashboardStats } from "@/lib/users"
import Link from "next/link"

export function AdminDashboardContent() {
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const stats = await getAdminDashboardStats()
        setData(stats)
      } catch (err) {
        console.error("Error loading dashboard stats:", err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const stats = data?.stats || { totalUsers: 0, activeClubs: 0, totalIncome: 0, totalBookings: 0 }
  const recentUsers = data?.recentUsers || []
  const recentRequests = data?.recentRequests || []
  const chartData = data?.chartData || []

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
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Registrados en el sistema</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clubes Activos</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeClubs}</div>
              <p className="text-xs text-muted-foreground">Cuentas de club aprobadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">S/. {stats.totalIncome.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Recaudación total por membresías</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservas Totales</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBookings}</div>
              <p className="text-xs text-muted-foreground">Reservas realizadas en la plataforma</p>
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
            <AdminStatsChart chartData={chartData} />
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
            </CardHeader>
            <CardContent>
              <AdminRecentUsers users={recentUsers} />
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
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/requests">Ver todas</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <AdminPendingRequests requests={recentRequests} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
