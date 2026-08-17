"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Download, Filter, MoreHorizontal, Plus, Search, X } from "lucide-react"
import { ReservationForm, reservationSchema } from "@/components/club/reservation-form"
import { cn } from "@/lib/utils"
import { Venues } from "./courts-content"
import { getAllVenues } from "@/lib/venues"
import { toast } from "sonner"
import { getAllCourtsByVenues } from "@/lib/courts"
import { cancelBooking, createReservationManual, getAllReservation, paymemtManual } from "@/lib/reservation"
import { Skeleton } from "../ui/skeleton"

const statusColors = {
  confirmed: "bg-green-100 text-green-800 hover:bg-green-200",
  pending: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  cancelled: "bg-red-100 text-red-800 hover:bg-red-200",
  completed: "bg-blue-100 text-blue-800 hover:bg-blue-200",
}

const paymentStatusColors = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  refunded: "bg-purple-100 text-purple-800",
}

export function ReservationsContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [reservations, setReservations] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [venueFilter, setVenueFilter] = useState("all")
  const [courts, setCourts] = useState<any[]>([])
  const [venues, setVenues] = useState<Venues[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [courtFilter, setCourtFilter] = useState("all")
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    const fetchCourts = async () => {
      const data = await getAllCourtsByVenues();
      setCourts([...data]);
    };
    const fetchVenues = async ()=>{
      try {
        const result = await getAllVenues()
        setVenues(result)
      } catch (error) {
        toast.error("Error al cargar las canchas")
      }
    }
    const fetchReservation = async ()=>{
      try {
        const reservations = (await getAllReservation());
        setReservations(reservations)
      } catch (error) {
        toast.error("Error al cargar las canchas")
      }
    }
    fetchVenues()
    fetchCourts()
    fetchReservation()
  }, [])

  // Filtrar reservas según los criterios
  const filteredReservations = reservations.filter((reservation) => {
    // Filtro por búsqueda
    const searchMatch =
      reservation.customerInfo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.customerInfo?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.court.name.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por estado
    const statusMatch = statusFilter === "all" || reservation.status === statusFilter

    // Filtro por sede
    const venueMatch =
      venueFilter === "all" || reservation.court.venue.name === venues.find((v) => v?.id?.toString() === venueFilter)?.name

    // Filtro por cancha
    const courtMatch =
      courtFilter === "all" || reservation.court.name === courts.find((c) => c.id.toString() === courtFilter)?.name
    reservation.date = new Date(reservation.date)
    // Filtro por fecha
    const dateMatch =
      (!dateRange.from || reservation.date >= dateRange.from) && (!dateRange.to || reservation.date <= dateRange.to)

    // Filtro por pestaña activa
    let tabMatch = true
    if (activeTab === "upcoming") {
      tabMatch = reservation.date >= new Date() && reservation.status !== "cancelled"
    } else if (activeTab === "past") {
      tabMatch = reservation.date < new Date() || reservation.status === "completed"
    } else if (activeTab === "cancelled") {
      tabMatch = reservation.status === "cancelled"
    }

    return searchMatch && statusMatch && venueMatch && courtMatch && dateMatch && tabMatch
  })

  const handlePayment = async(reservation:any) =>{
    setIsLoading(true)
    try {   
      const result = await paymemtManual(reservation);
  
      setReservations((reservations) =>
        reservations.map((value) =>
          value.id === result.id ? result : value
        )
      );
    } catch (error) {
      toast.error(`Error al registrar el pago ${JSON.stringify(error)}`);
      setIsLoading(false)

    }finally{
      setIsLoading(false)
    }
  }

  const handleCancelPayment = async(reservation:any) =>{
    setIsLoading(true)

    try {
      const result = await cancelBooking(reservation); // o el nombre correcto
      setReservations((reservations) =>
        reservations.map((value) =>
          value.id === result.id ? result  : value 
        )
      );
    } catch (error) {
      toast.error(`Error al cancelar la reserva ${JSON.stringify(error)}`);

      console.error("Error al cancelar la reserva:", error);
      setIsLoading(false)

    }finally{
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      confirmed: "Confirmada",
      pending: "Pendiente",
      cancelled: "Cancelada",
      completed: "Completada",
    }

    return <Badge className={statusColors[status as keyof typeof statusColors]}>{statusLabels[status] || status}</Badge>
  }

  const getPaymentStatusBadge = (status: string) => {
    const paymentLabels: Record<string, string> = {
      paid: "Pagado",
      pending: "Pendiente",
      refunded: "Reembolsado",
    }

    return (
      <Badge className={paymentStatusColors[status as keyof typeof paymentStatusColors]}>
        {paymentLabels[status] || status}
      </Badge>
    )
  }
  const addBooking = async (data:any)=>{
    setIsSubmitting(true);
    try {
      const result = await createReservationManual(data);
      setReservations((prev) => [...prev, result]);
      setIsCreateDialogOpen(false);
      toast.success("Reserva creada con éxito");
    } catch (error:any) {
       // Si el error tiene respuesta de la API (Axios)
        if (error.response?.data?.message) {
          toast.error(`${error.response.data.message}`);
        } else {
          toast.error("Error inesperado al crear la reserva");
        }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reservas</h2>
          <p className="text-muted-foreground">Gestiona todas las reservas de tus instalaciones deportivas</p>
        </div>
        <div className="flex gap-2">
          {/* <Button variant="outline" onClick={() => handleExportCSV()} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button> */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Crear Nueva Reserva</DialogTitle>
                <DialogDescription>Completa el formulario para crear una reserva manualmente</DialogDescription>
              </DialogHeader>
              <ReservationForm venues={venues} courts={courts} onSubmit={addBooking} isSubmitting={isSubmitting}/>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="past">Pasadas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-6">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, email o ID..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                {(statusFilter !== "all" ||
                  venueFilter !== "all" ||
                  courtFilter !== "all" ||
                  dateRange.from ||
                  dateRange.to) && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    <span className="text-xs">
                      {[
                        statusFilter !== "all" ? 1 : 0,
                        venueFilter !== "all" ? 1 : 0,
                        courtFilter !== "all" ? 1 : 0,
                        dateRange.from || dateRange.to ? 1 : 0,
                      ].reduce((a, b) => a + b, 0)}
                    </span>
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Filtrar Reservas</h4>

                <div className="space-y-2">
                  <Label htmlFor="status-filter">Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="confirmed">Confirmadas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="completed">Completadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue-filter">Sede</Label>
                  <Select value={venueFilter} onValueChange={setVenueFilter}>
                    <SelectTrigger id="venue-filter">
                      <SelectValue placeholder="Todas las sedes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sedes</SelectItem>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={`${venue.id}`}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="court-filter">Cancha</Label>
                  <Select value={courtFilter} onValueChange={setCourtFilter}>
                    <SelectTrigger id="court-filter">
                      <SelectValue placeholder="Todas las canchas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las canchas</SelectItem>
                      {courts
                        .filter((court) => venueFilter === "all" || court.venue.id == venueFilter)
                        .map((court) => (
                          <SelectItem key={court.id} value={`${court.id}`}>
                            {court.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rango de fechas</Label>
                  <div className="flex flex-col gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !dateRange.from && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "dd/MM/yyyy", { locale: es }) : "Fecha inicial"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !dateRange.to && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "dd/MM/yyyy", { locale: es }) : "Fecha final"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                          initialFocus
                          disabled={(date) => (dateRange.from ? date < dateRange.from : false)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStatusFilter("all")
                      setVenueFilter("all")
                      setCourtFilter("all")
                      setDateRange({ from: undefined, to: undefined })
                    }}
                  >
                    Limpiar filtros
                  </Button>
                  <Button onClick={() => setIsFilterOpen(false)}>Aplicar filtros</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Mostrar filtros activos */}
      {(statusFilter !== "all" || venueFilter !== "all" || courtFilter !== "all" || dateRange.from || dateRange.to) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              Estado:{" "}
              {statusFilter === "confirmed"
                ? "Confirmada"
                : statusFilter === "pending"
                  ? "Pendiente"
                  : statusFilter === "completed"
                    ? "Completada"
                    : "Cancelada"}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
            </Badge>
          )}

          {venueFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              Sede: {venues.find((v) => `${v.id}` === venueFilter)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setVenueFilter("all")} />
            </Badge>
          )}

          {courtFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              Cancha: {courts.find((c) => c.id.toString() === courtFilter)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setCourtFilter("all")} />
            </Badge>
          )}

          {dateRange.from && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              Desde: {format(dateRange.from, "dd/MM/yyyy", { locale: es })}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange({ ...dateRange, from: undefined })} />
            </Badge>
          )}

          {dateRange.to && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              Hasta: {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setDateRange({ ...dateRange, to: undefined })} />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setStatusFilter("all")
              setVenueFilter("all")
              setCourtFilter("all")
              setDateRange({ from: undefined, to: undefined })
            }}
          >
            Limpiar todos
          </Button>
        </div>
      )}

      {/* Vista de tabla para pantallas grandes */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Cancha</TableHead>
              <TableHead>Fecha y Hora</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length > 0 ? (
              filteredReservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell className="font-medium">{reservation.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{reservation.customerInfo.name}</div>
                    <div className="text-sm text-muted-foreground">{reservation.customerInfo.email}</div>
                  </TableCell>
                  <TableCell>
                    <div>{reservation.court.name}</div>
                    <div className="text-sm text-muted-foreground">{reservation.court.venue.name}</div>
                  </TableCell>
                  <TableCell>
                    <div>{format(reservation.date, "dd/MM/yyyy")}</div>
                    <div className="text-sm text-muted-foreground">
                    {reservation.startTime} - {reservation.endTime}
                    </div>
                  </TableCell>
                  <TableCell>{reservation.duration} horas</TableCell>
                  <TableCell>S/ {(reservation?.pricing?.totalPrice)}</TableCell>
                  <TableCell>
                    {isLoading ? <Skeleton className="h-6 w-24 rounded bg-gray-200" />: getStatusBadge(reservation.status)}
                     
                  </TableCell>
                  <TableCell>
                    {isLoading ? <Skeleton className="h-6 w-24 rounded bg-gray-200" />: getPaymentStatusBadge(reservation.paymentStatus)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {reservation.status === "pending" && <DropdownMenuItem onClick={() => handlePayment(reservation)} >Confirmar reserva</DropdownMenuItem>}
                        {(reservation.status === "pending" || reservation.status === "confirmed") && (
                          <DropdownMenuItem className="text-red-600" onClick={()=>{handleCancelPayment(reservation)}}>Cancelar reserva</DropdownMenuItem>
                        )}
                        {/* {reservation.status === "confirmed" && (
                          <DropdownMenuItem>Marcar como completada</DropdownMenuItem>
                        )} */}
                        {/* {reservation.paymentStatus === "pending" && <DropdownMenuItem>Registrar pago</DropdownMenuItem>} */}
                        {/* <DropdownMenuItem>Enviar recordatorio</DropdownMenuItem> */}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No se encontraron reservas con los filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Vista de tarjetas para móviles */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredReservations.length > 0 ? (
          filteredReservations.map((reservation) => (
            <Card key={reservation.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{reservation.court.name}</CardTitle>
                    <CardDescription>{reservation.court.venue.name}</CardDescription>
                  </div>
                  {isLoading ? <Skeleton className="h-6 w-24 rounded bg-gray-200" />: getStatusBadge(reservation.status)}

                  {/* {getStatusBadge(reservation.status)} */}
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usuario:</span>
                    <span className="font-medium">{reservation.customerInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha:</span>
                    <span>{format(reservation.date, "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hora:</span>
                    <span>
                      {reservation.startTime} - {reservation.endTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio:</span>
                    <span className="font-medium">S/ {reservation?.pricing?.totalPrice} </span>
                  </div>
                  {/* <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pago:</span>
                    {getPaymentStatusBadge(reservation.paymentStatus)}
                  </div> */}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Button variant="outline" size="sm">
                  Ver detalles
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Más acciones</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {reservation.status === "pending" && <DropdownMenuItem onClick={() => handlePayment(reservation)}>Confirmar reserva</DropdownMenuItem>}
                    {(reservation.status === "pending" || reservation.status === "confirmed") && (
                      <DropdownMenuItem className="text-red-600" onClick={()=>{handleCancelPayment(reservation)}}>Cancelar reserva</DropdownMenuItem>
                    )}
                    {/* {reservation.status === "confirmed" && <DropdownMenuItem>Marcar como completada</DropdownMenuItem>} */}
                    {/* {reservation.paymentStatus === "pending" && <DropdownMenuItem>Registrar pago</DropdownMenuItem>} */}
                    {/* <DropdownMenuItem>Enviar recordatorio</DropdownMenuItem> */}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-24">
              <p className="text-muted-foreground">No se encontraron reservas con los filtros aplicados.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
