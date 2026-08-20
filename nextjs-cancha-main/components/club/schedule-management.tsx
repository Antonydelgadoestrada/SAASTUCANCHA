"use client"

import { useEffect, useState } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon, PlusIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { bulkUpdate, getByCourt } from "@/lib/schedule"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ScheduleTimeSlot } from "@/components/club/schedule-time-slot"
import { ScheduleTemplateForm } from "@/components/club/schedule-template-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getAllCourtsByClub } from "@/lib/courts"

export function ScheduleManagement() {
  const [date, setDate] = useState<Date>(new Date())
  const [courts, setCourts] = useState([])
  const [scheduleChanges, setScheduleChanges] = useState<{[key: string]: any}>({})
  const [selectedCourt, setSelectedCourt] = useState<string>("all")
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  
  const queryClient = useQueryClient()
  // setting data
  useEffect(()=>{
    const fetchCourts = async () => {
      try {
        const data = await getAllCourtsByClub()
        setCourts(data)
      } catch (error) {
        toast.error("Error al cargar las canchas")
      }
    }
    fetchCourts()
  },[])
  // Canchas sin filtro
  const filteredCourts = courts
  // Generar días de la semana a partir de la fecha seleccionada
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Hook para cargar datos de horarios reales usando React Query
  const { data: courtSchedule, isLoading, error, refetch } = useQuery({
    queryKey: ['court-schedule', selectedCourt, weekStart],
    queryFn: () => getByCourt(
      format(weekStart, 'yyyy-MM-dd'),
      format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      selectedCourt === "all" ? courts[0]?.id?.toString() : selectedCourt
    ),
    enabled: selectedCourt !== "all" && courts.length > 0 && selectedCourt !== undefined
  })

  const handleSaveSchedule = async () => {
    try {
      const changesArray = Object.values(scheduleChanges)
      if (changesArray.length > 0) {
        await bulkUpdate(changesArray)
        setScheduleChanges({})
        toast.success("Horarios guardados correctamente")
        // Invalidar caché para recargar datos automáticamente
        queryClient.invalidateQueries(['court-schedule'])
      } else {
        toast.info("No hay cambios para guardar")
      }
    } catch (error) {
      toast.error("Error al guardar horarios")
      console.error(error)
    }
  }

  const handleApplyTemplate = (template: any) => {
    setIsTemplateDialogOpen(false)
    toast.success("Plantilla aplicada correctamente")
  }

  const handleSlotChange = (status: string, time: string, date: Date) => {
    const changeKey = `${format(date, 'yyyy-MM-dd')}-${time}`
    setScheduleChanges(prev => ({
      ...prev,
      [changeKey]: {
        courtId: selectedCourt,
        date: format(date, 'yyyy-MM-dd'),
        time,
        status
      }
    }))
  }

  // Estados de carga y error
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando horarios...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error al cargar horarios</p>
          <Button onClick={() => refetch()} variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Configuración de Horarios</CardTitle>
              <CardDescription>Gestiona los horarios disponibles de tus canchas</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -7))}>
                <ChevronLeftIcon className="h-4 w-4" />
                <span className="sr-only">Semana anterior</span>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[240px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(date) => date && setDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 7))}>
                <ChevronRightIcon className="h-4 w-4" />
                <span className="sr-only">Semana siguiente</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrar:</span>
              </div>

              <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas las canchas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las canchas</SelectItem>
                  {filteredCourts.map((court:any) => (
                    <SelectItem key={court.id} value={court.id.toString()}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Aplicar Plantilla
                  </Button>
                </DialogTrigger>
                {/* <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"> */}
                <DialogContent className="w-full sm:max-w-[400px] md:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Aplicar Plantilla de Horarios</DialogTitle>
                    <DialogDescription>
                      Selecciona una plantilla predefinida o crea una nueva para aplicar a los horarios seleccionados.
                    </DialogDescription>
                  </DialogHeader>
                  <ScheduleTemplateForm onSubmit={handleApplyTemplate} />
                </DialogContent>
              </Dialog>
              <Button onClick={handleSaveSchedule}>
                <SaveIcon className="mr-2 h-4 w-4" />
                Guardar Cambios
              </Button>
            </div>
          </div>

          {/* Vista para escritorio */}
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-8 gap-2 border-b pb-2">
                <div className="px-2 py-1 text-sm font-medium">Horario</div>
                {weekDays.map((day, i) => (
                  <div key={i} className="px-2 py-1 text-center">
                    <div className="text-sm font-medium">{format(day, "EEEE", { locale: es })}</div>
                    <div className="text-sm text-muted-foreground">{format(day, "d MMM", { locale: es })}</div>
                  </div>
                ))}
              </div>

              {/* Horarios */}
              {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-2 border-b py-1">
                  <div className="flex items-center px-2 text-sm">{hour}:00</div>
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const timeStr = `${hour}:00`;
                    const changeKey = `${dateStr}-${timeStr}`;
                    const slot = courtSchedule?.find(s => 
                      s.date === dateStr && s.time === timeStr
                    )
                    const currentStatus = scheduleChanges[changeKey]?.status || slot?.status || "available";
                    
                    return (
                      <ScheduleTimeSlot
                        key={`${dateStr}-${timeStr}-${i}`}
                        status={currentStatus}
                        time={timeStr}
                        date={day}
                        onStatusChange={handleSlotChange}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Vista para móvil */}
          <div className="md:hidden">
            <div className="space-y-6">
              {filteredCourts.slice(0, 2).map((court:any) => (
                <div key={court.id} className="space-y-2">
                  <h3 className="text-lg font-medium">{court.name}</h3>
                  {/* <p className="text-sm text-muted-foreground">{court.venue}</p> */}

                  <div className="space-y-4">
                    {weekDays.slice(0, 3).map((day, dayIndex) => (
                      <div key={dayIndex} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{format(day, "EEEE d 'de' MMMM", { locale: es })}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 8 }, (_, i) => i + 6).map((hour) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const timeStr = `${hour}:00`;
                            const changeKey = `${dateStr}-${timeStr}`;
                            const slot = courtSchedule?.find((s: any) => 
                              s.date === dateStr && s.time === timeStr
                            )
                            const currentStatus = scheduleChanges[changeKey]?.status || slot?.status || "available";
                            
                            return (
                              <ScheduleTimeSlot 
                                key={`${dateStr}-${timeStr}`} 
                                status={currentStatus} 
                                time={timeStr} 
                                date={day} 
                                compact 
                                onStatusChange={handleSlotChange} 
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" className="w-full">
                      Ver todos los horarios
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Horarios Especiales</CardTitle>
          <CardDescription>Define horarios especiales para días festivos o eventos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Días Festivos</h3>
              <p className="text-sm text-muted-foreground">
                Configura horarios especiales para días festivos o feriados.
              </p>
              <Button variant="outline" className="w-fit">
                <PlusIcon className="mr-2 h-4 w-4" />
                Agregar Día Festivo
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Eventos Especiales</h3>
              <p className="text-sm text-muted-foreground">
                Configura horarios especiales para torneos, eventos o mantenimiento.
              </p>
              <Button variant="outline" className="w-fit">
                <PlusIcon className="mr-2 h-4 w-4" />
                Agregar Evento Especial
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leyenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <span className="text-sm">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-red-500"></div>
              <span className="text-sm">Ocupado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-gray-500"></div>
              <span className="text-sm">Bloqueado</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
