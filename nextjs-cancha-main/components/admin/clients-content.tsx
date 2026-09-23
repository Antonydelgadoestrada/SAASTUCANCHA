"use client"

import { useState, useEffect, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  UsersIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ClockIcon,
  XCircleIcon,
  DollarSignIcon,
  SearchIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  ShieldAlertIcon,
  SparklesIcon,
  InfoIcon,
  MessageCircleIcon,
  FilterIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  getAdminClients,
  AdminClubClient,
  AdminClientsStats,
} from "@/lib/membership"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function AdminClientsContent() {
  const [clients, setClients] = useState<AdminClubClient[]>([])
  const [stats, setStats] = useState<AdminClientsStats>({
    totalClubs: 0,
    activeMemberships: 0,
    expiringSoon: 0,
    gracePeriod: 0,
    expired: 0,
    mrr: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [selectedClient, setSelectedClient] = useState<AdminClubClient | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const loadData = async (filterVal = statusFilter, searchVal = searchQuery) => {
    setIsLoading(true)
    try {
      const res = await getAdminClients({
        search: searchVal,
        filter: filterVal === "ALL" ? undefined : filterVal,
      })
      setClients(res.clients || [])
      setStats(res.stats || {
        totalClubs: 0,
        activeMemberships: 0,
        expiringSoon: 0,
        gracePeriod: 0,
        expired: 0,
        mrr: 0,
      })
    } catch (err: any) {
      console.error("Error al cargar clientes:", err)
      toast.error("Error al cargar listado de clubes y membresías", {
        description: err?.response?.data?.message || err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(statusFilter, searchQuery)
  }, [statusFilter])

  // Filtrado local reactivo para respuesta instantánea al tipear
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients
    const q = searchQuery.toLowerCase().trim()
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.district && c.district.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    )
  }, [clients, searchQuery])

  const formatDateSafely = (dateStr?: string | null) => {
    if (!dateStr) return "N/A"
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: es })
    } catch (e) {
      return dateStr
    }
  }

  const handleOpenDetail = (client: AdminClubClient) => {
    setSelectedClient(client)
    setIsDetailOpen(true)
  }

  const getWhatsAppLink = (phone?: string, clubName?: string, daysRemaining?: number) => {
    if (!phone) return "#"
    const cleaned = phone.replace(/\D/g, "")
    const fullPhone = cleaned.startsWith("51") ? cleaned : `51${cleaned}`
    const msg = encodeURIComponent(
      `Hola equipo de ${clubName || "su complejo"}, te saludamos desde la administración de TuCancha.pe. Nos comunicamos respecto al estado de su suscripción de membresía.`
    )
    return `https://wa.me/${fullPhone}?text=${msg}`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-primary" />
            Directorio de Clientes y Membresías
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitoreo en tiempo real de clubes deportivos, vigencia de planes contratados y alertas tempranas de renovación.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(statusFilter, searchQuery)}
          disabled={isLoading}
          className="flex items-center gap-2 shadow-xs"
        >
          <RefreshCwIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Membresías Activas
            </CardTitle>
            <CheckCircle2Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-300">
              {stats.activeMemberships}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              De un total de {stats.totalClubs} clubes registrados
            </p>
          </CardContent>
        </Card>

        <Card className={`border-amber-500/30 ${stats.expiringSoon > 0 ? "bg-amber-500/10" : "bg-amber-500/5"}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Próximos a Vencer
            </CardTitle>
            <AlertTriangleIcon className={`w-5 h-5 text-amber-600 dark:text-amber-400 ${stats.expiringSoon > 0 ? "animate-bounce" : ""}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-800 dark:text-amber-300">
              {stats.expiringSoon}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vencen en los próximos 7 días
            </p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/20 bg-rose-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">
              En Gracia / Vencidas
            </CardTitle>
            <ClockIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-800 dark:text-rose-300">
              {stats.gracePeriod + stats.expired}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.gracePeriod} en gracia · {stats.expired} vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
              MRR Recurrente Estimado
            </CardTitle>
            <DollarSignIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800 dark:text-blue-300">
              S/. {stats.mrr.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos mensuales recurrentes de membresía
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre de club, email, distrito o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <Tabs
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="w-full md:w-auto"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full md:w-auto h-auto p-1 gap-1">
              <TabsTrigger value="ALL" className="text-xs py-1.5 px-3">
                Todos ({stats.totalClubs})
              </TabsTrigger>
              <TabsTrigger value="ACTIVE" className="text-xs py-1.5 px-3">
                Activas ({stats.activeMemberships})
              </TabsTrigger>
              <TabsTrigger value="EXPIRING" className="text-xs py-1.5 px-3 text-amber-600 dark:text-amber-400 font-semibold">
                Por Vencer ({stats.expiringSoon})
              </TabsTrigger>
              <TabsTrigger value="GRACE" className="text-xs py-1.5 px-3">
                En Gracia ({stats.gracePeriod})
              </TabsTrigger>
              <TabsTrigger value="EXPIRED" className="text-xs py-1.5 px-3">
                Vencidas ({stats.expired})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tabla de Clubes Clientes */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[280px]">Club Deportivo</TableHead>
                  <TableHead>Plan Contratado</TableHead>
                  <TableHead>Vigencia (Inicio - Fin)</TableHead>
                  <TableHead>Estado & Alerta</TableHead>
                  <TableHead className="text-center">Renovación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <RefreshCwIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Cargando clubes y membresías...
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      No se encontraron clubes para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => {
                    const mem = client.membership
                    const isExpiring = client.isExpiringSoon && mem?.status === "ACTIVE"
                    const isGrace = mem?.status === "GRACE"
                    const isActive = mem?.status === "ACTIVE"
                    const isExpired = mem?.status === "EXPIRED" || (!mem && !client.isTrialActive)

                    return (
                      <TableRow
                        key={client.id}
                        className={isExpiring ? "bg-amber-500/5 hover:bg-amber-500/10" : isGrace ? "bg-rose-500/5 hover:bg-rose-500/10" : ""}
                      >
                        {/* Club */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border">
                              <AvatarImage src={client.logo} alt={client.name} />
                              <AvatarFallback className="font-bold bg-primary/10 text-primary">
                                {client.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                {client.name}
                                {client.status === "SUSPENDED" && (
                                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 px-1 py-0">
                                    Suspendido
                                  </Badge>
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPinIcon className="w-3 h-3 text-muted-foreground/70" />
                                {client.district || "Distrito no especificado"}
                              </span>
                              <span className="text-xs text-muted-foreground/80">
                                {client.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Plan */}
                        <TableCell>
                          {mem ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-foreground">
                                {mem.planName}
                              </span>
                              <span className="text-xs text-muted-foreground font-semibold">
                                S/. {Number(mem.price).toFixed(2)}{" "}
                                <span className="font-normal text-[11px] text-muted-foreground/70">
                                  / {mem.interval === "ANNUAL" ? "Año" : mem.interval === "SEMIANNUAL" ? "Semestre" : "Mes"}
                                </span>
                              </span>
                            </div>
                          ) : client.isTrialActive ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm text-blue-600 dark:text-blue-400">
                                Período de Prueba
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Hasta {formatDateSafely(client.trialEndDate)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Sin plan registrado
                            </span>
                          )}
                        </TableCell>

                        {/* Vigencia */}
                        <TableCell>
                          {mem ? (
                            <div className="flex flex-col text-xs">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span>Desde:</span>
                                <span className="font-medium text-foreground">
                                  {formatDateSafely(mem.startDate)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span>Hasta:</span>
                                <span className="font-semibold text-foreground">
                                  {formatDateSafely(mem.endDate)}
                                </span>
                              </div>
                            </div>
                          ) : client.isTrialActive ? (
                            <span className="text-xs text-muted-foreground">
                              Finaliza: {formatDateSafely(client.trialEndDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Estado & Alerta de Vencimiento */}
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {isExpiring && (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs flex items-center gap-1 animate-pulse">
                                <AlertTriangleIcon className="w-3.5 h-3.5" />
                                {mem.daysRemaining === 0
                                  ? "¡Vence Hoy!"
                                  : mem.daysRemaining === 1
                                  ? "¡Vence Mañana!"
                                  : `Vence en ${mem.daysRemaining} días`}
                              </Badge>
                            )}

                            {isActive && !isExpiring && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1">
                                <CheckCircle2Icon className="w-3.5 h-3.5" />
                                Activa ({mem.daysRemaining} días rest.)
                              </Badge>
                            )}

                            {isGrace && (
                              <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs flex items-center gap-1 font-semibold">
                                <ClockIcon className="w-3.5 h-3.5" />
                                En Gracia (Límite: {formatDateSafely(mem.graceEndDate)})
                              </Badge>
                            )}

                            {isExpired && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <XCircleIcon className="w-3.5 h-3.5" />
                                Expirada / Vencida
                              </Badge>
                            )}

                            {!mem && client.isTrialActive && (
                              <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30 text-xs">
                                Prueba Gratuita
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Renovación */}
                        <TableCell className="text-center">
                          {mem ? (
                            mem.autoRenew && !mem.cancelAtPeriodEnd ? (
                              <Badge variant="outline" className="text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                Automática
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground border-border">
                                No renueva
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {client.phone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Contactar por WhatsApp"
                                asChild
                              >
                                <a
                                  href={getWhatsAppLink(client.phone, client.name, mem?.daysRemaining)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MessageCircleIcon className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs flex items-center gap-1"
                              onClick={() => handleOpenDetail(client)}
                            >
                              <InfoIcon className="w-3.5 h-3.5" />
                              Ver Ficha
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalle de Ficha de Club */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={selectedClient.logo} alt={selectedClient.name} />
                    <AvatarFallback className="font-bold bg-primary/10 text-primary text-base">
                      {selectedClient.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl font-bold">
                      {selectedClient.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Registrado el {formatDateSafely(selectedClient.createdAt)} · ID: {selectedClient.id}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Alerta si está por vencer o en gracia */}
                {selectedClient.isExpiringSoon && selectedClient.membership && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
                    <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        {selectedClient.membership.status === "GRACE"
                          ? "Membresía en Período de Gracia"
                          : `Membresía por vencer en ${selectedClient.membership.daysRemaining} días`}
                      </p>
                      <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                        La suscripción finaliza el {formatDateSafely(selectedClient.membership.endDate)}.
                        Se recomienda comunicarse con el club para coordinar la renovación oportuna.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid con detalles de suscripción */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-muted/40 border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Suscripción TuCancha
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan:</span>
                        <span className="font-semibold text-foreground">
                          {selectedClient.membership?.planName || "Ninguno"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarifa:</span>
                        <span className="font-semibold text-foreground">
                          S/. {Number(selectedClient.membership?.price || 0).toFixed(2)} / {selectedClient.membership?.interval || "MONTHLY"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha Inicio:</span>
                        <span className="font-medium text-foreground">
                          {formatDateSafely(selectedClient.membership?.startDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha Vencimiento:</span>
                        <span className="font-semibold text-primary">
                          {formatDateSafely(selectedClient.membership?.endDate)}
                        </span>
                      </div>
                      {selectedClient.membership?.graceEndDate && (
                        <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400">
                          <span>Fin de Gracia:</span>
                          <span className="font-medium">
                            {formatDateSafely(selectedClient.membership.graceEndDate)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t text-xs">
                        <span className="text-muted-foreground">Auto-Renovación:</span>
                        <span className="font-medium">
                          {selectedClient.membership?.autoRenew ? "Activada" : "Desactivada"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/40 border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Datos del Club y Propietario
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MailIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground truncate">{selectedClient.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{selectedClient.phone || "No registrado"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-foreground">{selectedClient.district}, {selectedClient.address}</span>
                      </div>
                      {selectedClient.owner && (
                        <div className="pt-2 border-t text-xs space-y-1">
                          <p className="text-muted-foreground font-medium">Titular de cuenta:</p>
                          <p className="text-foreground font-semibold">{selectedClient.owner.name}</p>
                          <p className="text-muted-foreground">{selectedClient.owner.email}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between">
                {selectedClient.phone ? (
                  <Button
                    variant="outline"
                    className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2"
                    asChild
                  >
                    <a
                      href={getWhatsAppLink(
                        selectedClient.phone,
                        selectedClient.name,
                        selectedClient.membership?.daysRemaining
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircleIcon className="w-4 h-4" />
                      Enviar Recordatorio por WhatsApp
                    </a>
                  </Button>
                ) : (
                  <div />
                )}
                <Button variant="secondary" onClick={() => setIsDetailOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
