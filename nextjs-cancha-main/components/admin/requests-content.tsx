"use client"

import { useState, useEffect, useMemo } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  SearchIcon,
  XIcon,
  CheckIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  BanIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  ExternalLinkIcon,
  EyeIcon,
  MessageCircleIcon,
  InboxIcon,
  CalendarIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { rejectClub, approveClub, getAllClubs, suspendClub, reactivateClub } from "@/lib/club"

export function AdminRequestsContent() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClub, setSelectedClub] = useState<any | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingClubsList, setPendingClubsList] = useState<any[]>([])
  const [approvedClubsList, setApprovedClubsList] = useState<any[]>([])
  const [suspendedClubsList, setSuspendedClubsList] = useState<any[]>([])
  const [rejectedClubsList, setRejectedClubsList] = useState<any[]>([])

  const fetchAllRequest = async () => {
    setIsRefreshing(true)
    try {
      const clubs = await getAllClubs()
      const pending = clubs.filter((club: any) => club.status === "PENDING")
      const approved = clubs.filter((club: any) => club.status === "APPROVED")
      const suspended = clubs.filter((club: any) => club.status === "SUSPENDED")
      const rejected = clubs.filter((club: any) => club.status === "REJECTED")
      setPendingClubsList(pending)
      setApprovedClubsList(approved)
      setSuspendedClubsList(suspended)
      setRejectedClubsList(rejected)
    } catch (err) {
      console.error("Error al cargar solicitudes de clubes:", err)
      toast.error("Error al cargar listado de clubes")
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAllRequest()
  }, [])

  // Filtrado reactivo de clubes según la búsqueda
  const filterByQuery = (list: any[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(
      (club) =>
        club.name.toLowerCase().includes(q) ||
        club.email.toLowerCase().includes(q) ||
        (club.address && club.address.toLowerCase().includes(q)) ||
        (club.district && club.district.toLowerCase().includes(q)) ||
        (club.phone && club.phone.includes(q))
    )
  }

  const filteredPendingClubs = useMemo(() => filterByQuery(pendingClubsList), [pendingClubsList, searchQuery])
  const filteredApprovedClubs = useMemo(() => filterByQuery(approvedClubsList), [approvedClubsList, searchQuery])
  const filteredSuspendedClubs = useMemo(() => filterByQuery(suspendedClubsList), [suspendedClubsList, searchQuery])
  const filteredRejectedClubs = useMemo(() => filterByQuery(rejectedClubsList), [rejectedClubsList, searchQuery])

  const handleViewDetails = (club: any) => {
    setSelectedClub(club)
    setIsDialogOpen(true)
  }

  const handleApprove = async (club: any) => {
    setIsLoading(true)
    try {
      await approveClub(club.id)
      await fetchAllRequest()
      toast.success(`Club "${club.name}" aprobado exitosamente`, {
        description: "Se habilitó su acceso al panel de administración y catálogo público.",
      })
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al aprobar el club")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async (club: any) => {
    setIsLoading(true)
    try {
      await rejectClub(club.id)
      await fetchAllRequest()
      toast.info(`Club "${club.name}" marcado como rechazado`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al rechazar el club")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuspend = async (club: any) => {
    setIsLoading(true)
    try {
      await suspendClub(club.id)
      await fetchAllRequest()
      toast.warning(`Acceso al club "${club.name}" suspendido`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al suspender el club")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReactivate = async (club: any) => {
    setIsLoading(true)
    try {
      await reactivateClub(club.id)
      await fetchAllRequest()
      toast.success(`Acceso al club "${club.name}" reactivado correctamente`)
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al reactivar el club")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDateSafely = (dateVal: any, pattern = "d MMM yyyy") => {
    if (!dateVal) return "N/A"
    try {
      const d = typeof dateVal === "string" ? parseISO(dateVal) : new Date(dateVal)
      return format(d, pattern, { locale: es })
    } catch (e) {
      return String(dateVal)
    }
  }

  const getWhatsAppLink = (phone?: string, clubName?: string) => {
    if (!phone) return "#"
    const cleaned = phone.replace(/\D/g, "")
    const fullPhone = cleaned.startsWith("51") ? cleaned : `51${cleaned}`
    const msg = encodeURIComponent(
      `Hola equipo de ${clubName || "su complejo"}, te saludamos desde la administración de TuCancha.pe respecto a su solicitud de registro.`
    )
    return `https://wa.me/${fullPhone}?text=${msg}`
  }

  const totalClubsCount =
    pendingClubsList.length + approvedClubsList.length + suspendedClubsList.length + rejectedClubsList.length

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Encabezado Superior */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2Icon className="w-7 h-7 text-primary" />
            Solicitudes y Control de Clubes
          </h1>
          <p className="text-muted-foreground text-sm">
            Evalúa nuevas solicitudes de complejos deportivos, aprueba accesos o gestiona suspensiones de servicio.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAllRequest}
          disabled={isRefreshing}
          className="flex items-center gap-2 shadow-xs shrink-0"
        >
          <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Tarjetas KPI de Estado */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("pending")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitudes Pendientes</CardTitle>
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingClubsList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingClubsList.length > 0
                ? "Requieren revisión para aprobación"
                : "Todo al día, sin solicitudes pendientes"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("approved")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clubes Aprobados</CardTitle>
            <CheckCircle2Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedClubsList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Operando activamente en la plataforma
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("suspended")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clubes Suspendidos</CardTitle>
            <BanIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suspendedClubsList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Acceso restringido temporalmente
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setActiveTab("rejected")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitudes Rechazadas</CardTitle>
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedClubsList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No admitidas en el catálogo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs y Buscador Integrado */}
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full md:w-auto h-auto p-1 gap-1">
              <TabsTrigger value="pending" className="text-xs py-2 px-3 flex items-center justify-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-amber-500" />
                <span>Pendientes</span>
                <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                  pendingClubsList.length > 0
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {pendingClubsList.length}
                </span>
              </TabsTrigger>

              <TabsTrigger value="approved" className="text-xs py-2 px-3 flex items-center justify-center gap-1.5">
                <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
                <span>Aprobados</span>
                <span className="ml-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 text-[11px] font-semibold">
                  {approvedClubsList.length}
                </span>
              </TabsTrigger>

              <TabsTrigger value="suspended" className="text-xs py-2 px-3 flex items-center justify-center gap-1.5">
                <BanIcon className="h-3.5 w-3.5 text-rose-500" />
                <span>Suspendidos</span>
                <span className="ml-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 px-1.5 py-0.2 text-[11px] font-semibold">
                  {suspendedClubsList.length}
                </span>
              </TabsTrigger>

              <TabsTrigger value="rejected" className="text-xs py-2 px-3 flex items-center justify-center gap-1.5">
                <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Rechazados</span>
                <span className="ml-1 rounded-full bg-muted text-muted-foreground px-1.5 py-0.2 text-[11px] font-semibold">
                  {rejectedClubsList.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <div className="relative flex-1 md:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por club, email o distrito..."
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── TAB PENDIENTES ────────────────────────────────────── */}
        <TabsContent value="pending" className="mt-0 space-y-4">
          {filteredPendingClubs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPendingClubs.map((club) => (
                <Card
                  key={club.id}
                  className="flex flex-col border-amber-500/30 hover:border-amber-500/60 transition-all shadow-xs"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border">
                          <AvatarImage src={club.logo || club.images?.[0]} alt={club.name} />
                          <AvatarFallback className="font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            {club.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base font-bold">{club.name}</CardTitle>
                          <CardDescription className="text-xs truncate max-w-[180px]">{club.email}</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs flex items-center gap-1 shrink-0">
                        <ClockIcon className="w-3 h-3" />
                        Pendiente
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs text-muted-foreground flex-1">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{club.district ? `${club.district} · ` : ""}{club.address}</span>
                    </div>
                    {club.phone && (
                      <div className="flex items-center gap-1.5">
                        <PhoneIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{club.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Solicitado: {formatDateSafely(club.createdAt, "d MMM yyyy, HH:mm")}</span>
                    </div>
                    {club.description && (
                      <p className="line-clamp-2 text-muted-foreground/80 italic pt-1 border-t">
                        "{club.description}"
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between gap-2 bg-muted/20">
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewDetails(club)}>
                      <EyeIcon className="w-3.5 h-3.5 mr-1" />
                      Detalles
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleReject(club)}
                        disabled={isLoading}
                      >
                        <XIcon className="w-3.5 h-3.5 mr-1" />
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleApprove(club)}
                        disabled={isLoading}
                      >
                        <CheckIcon className="w-3.5 h-3.5 mr-1" />
                        Aprobar
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            /* Empty State Mejorado y Elegante */
            <Card className="border border-border/60 bg-card/60 backdrop-blur-xs">
              <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
                <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-500/20 shadow-xs">
                  <CheckCircle2Icon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  {searchQuery ? "No hay solicitudes que coincidan con la búsqueda" : "¡Todo al día! No hay solicitudes pendientes"}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  {searchQuery
                    ? `No se encontraron solicitudes pendientes con el término "${searchQuery}".`
                    : "Todas las solicitudes de registro de clubes han sido procesadas. Los clubes nuevos que se registren aparecerán aquí de forma inmediata para su revisión."}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => setActiveTab("approved")}
                  >
                    <span>Ver Clubes Aprobados ({approvedClubsList.length})</span>
                    <ArrowRightIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                  >
                    <Link href="/admin/clients">
                      <span>Ir a Directorio de Clientes</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB APROBADOS ─────────────────────────────────────── */}
        <TabsContent value="approved" className="mt-0 space-y-4">
          {filteredApprovedClubs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredApprovedClubs.map((club) => (
                <Card
                  key={club.id}
                  className="flex flex-col border-emerald-500/20 hover:border-emerald-500/50 transition-all shadow-xs"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border">
                          <AvatarImage src={club.logo || club.images?.[0]} alt={club.name} />
                          <AvatarFallback className="font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            {club.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base font-bold">{club.name}</CardTitle>
                          <CardDescription className="text-xs truncate max-w-[180px]">{club.email}</CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs flex items-center gap-1 shrink-0">
                        <CheckCircle2Icon className="w-3 h-3" />
                        Aprobado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs text-muted-foreground flex-1">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{club.district ? `${club.district} · ` : ""}{club.address}</span>
                    </div>
                    {club.phone && (
                      <div className="flex items-center gap-1.5">
                        <PhoneIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{club.phone}</span>
                      </div>
                    )}
                    {club.approvedAt && (
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>Aprobado el: {formatDateSafely(club.approvedAt)}</span>
                      </div>
                    )}
                    {club.trialEndDate && (
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                        Prueba gratuita hasta: {formatDateSafely(club.trialEndDate)}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between gap-2 bg-muted/20">
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewDetails(club)}>
                      <EyeIcon className="w-3.5 h-3.5 mr-1" />
                      Ver Ficha
                    </Button>
                    <div className="flex items-center gap-1.5">
                      {club.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          title="Contactar por WhatsApp"
                          asChild
                        >
                          <a href={getWhatsAppLink(club.phone, club.name)} target="_blank" rel="noopener noreferrer">
                            <MessageCircleIcon className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleSuspend(club)}
                        disabled={isLoading}
                      >
                        <BanIcon className="w-3.5 h-3.5 mr-1" />
                        Suspender
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2Icon className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-semibold">No se encontraron clubes aprobados</h3>
                <p className="text-sm text-muted-foreground mt-1">Aún no hay clubes en estado aprobado.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB SUSPENDIDOS ───────────────────────────────────── */}
        <TabsContent value="suspended" className="mt-0 space-y-4">
          {filteredSuspendedClubs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSuspendedClubs.map((club) => (
                <Card
                  key={club.id}
                  className="flex flex-col border-rose-500/30 hover:border-rose-500/60 transition-all shadow-xs"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border">
                          <AvatarImage src={club.logo || club.images?.[0]} alt={club.name} />
                          <AvatarFallback className="font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400">
                            {club.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base font-bold">{club.name}</CardTitle>
                          <CardDescription className="text-xs truncate max-w-[180px]">{club.email}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-xs flex items-center gap-1 shrink-0">
                        <BanIcon className="w-3 h-3" />
                        Suspendido
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs text-muted-foreground flex-1">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{club.district ? `${club.district} · ` : ""}{club.address}</span>
                    </div>
                    {club.phone && (
                      <div className="flex items-center gap-1.5">
                        <PhoneIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span>{club.phone}</span>
                      </div>
                    )}
                    {club.trialEndDate && (
                      <div className="text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded">
                        Prueba vencida: {formatDateSafely(club.trialEndDate)}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between gap-2 bg-muted/20">
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewDetails(club)}>
                      <EyeIcon className="w-3.5 h-3.5 mr-1" />
                      Detalles
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleReactivate(club)}
                      disabled={isLoading}
                    >
                      <CheckIcon className="w-3.5 h-3.5 mr-1" />
                      Reactivar Acceso
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheckIcon className="w-12 h-12 text-emerald-500/50 mb-3" />
                <h3 className="text-lg font-semibold">No hay clubes suspendidos</h3>
                <p className="text-sm text-muted-foreground mt-1">Todos los complejos deportivos cuentan con acceso activo.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── TAB RECHAZADOS ────────────────────────────────────── */}
        <TabsContent value="rejected" className="mt-0 space-y-4">
          {filteredRejectedClubs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRejectedClubs.map((club) => (
                <Card key={club.id} className="flex flex-col border-border/60 shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border">
                          <AvatarImage src={club.logo || club.images?.[0]} alt={club.name} />
                          <AvatarFallback className="font-bold bg-muted text-muted-foreground">
                            {club.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base font-bold">{club.name}</CardTitle>
                          <CardDescription className="text-xs truncate max-w-[180px]">{club.email}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <XIcon className="w-3 h-3" />
                        Rechazado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs text-muted-foreground flex-1">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MapPinIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{club.district ? `${club.district} · ` : ""}{club.address}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between gap-2 bg-muted/20">
                    <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => handleViewDetails(club)}>
                      <EyeIcon className="w-3.5 h-3.5 mr-1" />
                      Detalles
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => handleApprove(club)}
                      disabled={isLoading}
                    >
                      <CheckIcon className="w-3.5 h-3.5 mr-1" />
                      Reconsiderar y Aprobar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <InboxIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-semibold">No hay solicitudes rechazadas</h3>
                <p className="text-sm text-muted-foreground mt-1">Ninguna solicitud de club ha sido descartada.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── MODAL DE FICHA TÉCNICA DEL CLUB ─────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedClub && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border">
                  <AvatarImage src={selectedClub.logo || selectedClub.images?.[0]} alt={selectedClub.name} />
                  <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                    {selectedClub.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    {selectedClub.name}
                    <Badge
                      className={
                        selectedClub.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : selectedClub.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : selectedClub.status === "SUSPENDED"
                          ? "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {selectedClub.status === "APPROVED"
                        ? "Aprobado"
                        : selectedClub.status === "PENDING"
                        ? "Pendiente"
                        : selectedClub.status === "SUSPENDED"
                        ? "Suspendido"
                        : "Rechazado"}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    ID: {selectedClub.id} · Registrado el {formatDateSafely(selectedClub.createdAt, "d MMMM yyyy, HH:mm")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Grid de Información de Contacto y Ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-muted/40 border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Datos de Contacto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MailIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{selectedClub.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{selectedClub.phone || "No especificado"}</span>
                    </div>
                    {selectedClub.owner && (
                      <div className="pt-2 border-t text-xs space-y-1">
                        <span className="text-muted-foreground">Propietario:</span>
                        <p className="font-semibold">{selectedClub.owner.name}</p>
                        <p className="text-muted-foreground">{selectedClub.owner.email}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/40 border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Ubicación y Sede
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPinIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{selectedClub.district || "Distrito no registrado"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedClub.address}</p>
                    {selectedClub.coordinates && (
                      <p className="text-[11px] font-mono text-muted-foreground pt-1 border-t">
                        GPS: {selectedClub.coordinates.lat?.toFixed(4)}, {selectedClub.coordinates.lng?.toFixed(4)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Fechas de vigencia y prueba */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedClub.approvedAt && (
                  <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider">Fecha de Aprobación</span>
                    <p className="text-foreground font-medium">{formatDateSafely(selectedClub.approvedAt, "d MMMM yyyy, HH:mm")}</p>
                  </div>
                )}
                {selectedClub.trialEndDate && (
                  <div className="p-3 rounded-lg border bg-blue-500/10 border-blue-500/20 text-xs space-y-1">
                    <span className="font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Prueba Gratuita</span>
                    <p className="text-foreground font-medium">Finaliza el {formatDateSafely(selectedClub.trialEndDate, "d MMMM yyyy")}</p>
                  </div>
                )}
              </div>

              {/* Descripción */}
              {selectedClub.description && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descripción del Complejo</span>
                  <p className="text-sm p-3 rounded-md bg-muted/40 border text-foreground/90 leading-relaxed">
                    {selectedClub.description}
                  </p>
                </div>
              )}

              {/* Servicios y Amenidades */}
              {selectedClub.services && selectedClub.services.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Servicios Ofrecidos</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClub.services.map((srv: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {srv}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between">
              {selectedClub.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1.5"
                  asChild
                >
                  <a
                    href={getWhatsAppLink(selectedClub.phone, selectedClub.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircleIcon className="w-4 h-4" />
                    Contactar por WhatsApp
                  </a>
                </Button>
              )}

              <div className="flex items-center gap-2 self-end">
                <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)}>
                  Cerrar
                </Button>

                {selectedClub.status === "PENDING" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleReject(selectedClub)}
                      disabled={isLoading}
                    >
                      <XIcon className="mr-1 h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleApprove(selectedClub)}
                      disabled={isLoading}
                    >
                      <CheckIcon className="mr-1 h-3.5 w-3.5" />
                      Aprobar Club
                    </Button>
                  </>
                )}

                {selectedClub.status === "APPROVED" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleSuspend(selectedClub)}
                    disabled={isLoading}
                  >
                    <BanIcon className="mr-1 h-3.5 w-3.5" />
                    Suspender Acceso
                  </Button>
                )}

                {selectedClub.status === "SUSPENDED" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleReactivate(selectedClub)}
                    disabled={isLoading}
                  >
                    <CheckIcon className="mr-1 h-3.5 w-3.5" />
                    Reactivar Acceso
                  </Button>
                )}

                {selectedClub.status === "REJECTED" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleApprove(selectedClub)}
                    disabled={isLoading}
                  >
                    <CheckIcon className="mr-1 h-3.5 w-3.5" />
                    Reconsiderar y Aprobar
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
