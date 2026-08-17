"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EditIcon,
  FilterIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ScheduleTimeSlot } from "@/components/club/schedule-time-slot";
import {
  bulkUpdate,
  createSchedule,
  editTemplate,
  getByCourt,
  getCourtScheduleEvents,
  getTemplateByClub,
  getTemplateByCourtId,
  parseCourtTemplateByCourtResponse,
} from "@/lib/schedule";
import { getAllCourtsByVenues } from "@/lib/courts";
import { getAllVenues } from "@/lib/venues";
import { FormSidebar } from "@/components/ui/form-sidebar";
import { ScheduleTemplateForm } from "./schedule-template-form";
import { EventsTab } from "./events-tab";

export type statusEnum = "occupied" | "blocked" | "available" | "on-hold" | "event";

type ScheduleTimeSlotProps = {
  status: "available" | "occupied" | "blocked" | "on-hold";
  time: string;
  date: Date;
  compact?: boolean;
  onStatusChange?: (
    status: "available" | "occupied" | "blocked",
    time: string,
    date: Date
  ) => void;
};

export function ClubSchedulesContent() {
  const [date, setDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [isTemplateSidebarOpen, setIsTemplateSidebarOpen] = useState(false);
  const [editionTemplate, setEditionTemplate] = useState(false);
  /** Plantilla de la fila que se abrió para editar (no siempre `templates[0]`). */
  const [templateToEdit, setTemplateToEdit] = useState<any>(null);
  const [timeSlotsToUpdate, setTimeSlotsToUpdate] = useState<Map<string, any>>(new Map());
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [eventSlots, setEventSlots] = useState<
    { date: string; time: string; status: string; eventId: string; name: string }[]
  >([]);
  const [courtTemplate, setCourtTemplate] = useState<any>(null);
  /** `schedule_template_id` de la cancha; sin esto no hay tab Eventos ni creación en API. */
  const [courtLinkedTemplateId, setCourtLinkedTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [courts, setCourts] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const timeSlotsByKey = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of timeSlots) {
      if (s?.date && s?.time) map.set(`${s.date}-${s.time}`, s);
    }
    return map;
  }, [timeSlots]);

  const eventSlotsByKey = useMemo(() => {
    const map = new Map<string, { eventId: string; name: string }>();
    for (const e of eventSlots) {
      if (e?.date && e?.time) map.set(`${e.date}-${e.time}`, { eventId: e.eventId, name: e.name });
    }
    return map;
  }, [eventSlots]);

  const resolveCellStatus = (
    dateStr: string,
    timeStr: string,
    day: Date,
    matchingSlot: any | undefined,
  ): statusEnum => {
    const pending = timeSlotsToUpdate.get(`${dateStr}-${timeStr}`)?.status as statusEnum | undefined;
    if (pending) return pending;

    const key = `${dateStr}-${timeStr}`;
    const slotStatus = matchingSlot?.status as statusEnum | undefined;

    // Evento se superpone a cualquier estado del horario (API/plantilla): ocupado, disponible, bloqueado, pendiente, etc.
    if (eventSlotsByKey.has(key)) return "event";

    if (slotStatus) return slotStatus;
    return getBaseStatus(timeStr, day);
  };

  const toTemplateDayKey = (d: Date): string => {
    // JS: 0=Sunday ... 6=Saturday
    const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return keys[d.getDay()] ?? "";
  };

  const isDayEnabledByTemplate = (d: Date): boolean => {
    const enabledDays: string[] = Array.isArray(courtTemplate?.days)
      ? courtTemplate.days.map((x: string) => String(x).toLowerCase())
      : [];
    // si no hay days definidos, asumimos habilitado
    if (enabledDays.length === 0) return true;
    return enabledDays.includes(toTemplateDayKey(d));
  };

  const getBaseStatus = (timeStr: string, day: Date): statusEnum => {
    // Sin plantilla cargada, por defecto lo consideramos "available"
    if (!courtTemplate) return "available";

    // Si el día no está habilitado en la plantilla, es bloqueado
    if (!isDayEnabledByTemplate(day)) return "blocked";

    // Buscar el slot de la plantilla para esa hora
    const tplSlots: any[] = Array.isArray(courtTemplate?.slots) ? courtTemplate.slots : [];
    const tplSlot = tplSlots.find((s: any) => s?.time === timeStr);
    if (!tplSlot) return "blocked";

    return (tplSlot.status as statusEnum) ?? "available";
  };
  const handleCourtChange = (courtId: string) => {
    setTimeSlots([]); // limpiar horarios anteriores
    setEventSlots([]);
    setCourtTemplate(null);
    setCourtLinkedTemplateId(null);
    setTimeSlotsToUpdate(new Map());
    setSelectedCourt(courtId);
  };

  const courtHasTemplateLinked =
    selectedCourt !== "all" && Boolean(selectedCourt) && Boolean(courtLinkedTemplateId);

  useEffect(() => {
    const fetchTemplates = async () => {
      setIsTemplatesLoading(true);
      try {
        const data = await getTemplateByClub();
        if (Array.isArray(data)) {
          setTemplates(data); // si ya es array
        } else if (data) {
          setTemplates([data]); // si es un solo objeto
        } else {
          setTemplates([]); // si es null/undefined
        }
      } catch (err) {
        toast.error("Error al obtener plantillas");
        setTemplates([]);
      } finally {
        setIsTemplatesLoading(false);
      }
    };
    const fetchVenues = async () => {
      const data = await getAllVenues();
      setVenues([...data]);
    };
    const fetchCourts = async () => {
      const data = await getAllCourtsByVenues();
      setCourts([...data]);
    };
    fetchCourts();
    fetchVenues();
    fetchTemplates();
  }, []);
  // Filtrar canchas según la sede seleccionada
  const filteredCourts = courts.filter((court) => {
    if (selectedVenue == "all") return true;
    return court.venue.id == selectedVenue;
  });

  const templateSlotTimes = useMemo(() => {
    const slots = Array.isArray(courtTemplate?.slots)
      ? courtTemplate.slots
      : templates[0]?.slots;
    if (!Array.isArray(slots)) return [] as string[];
    return slots.map((s: { time?: string }) => s?.time).filter(Boolean) as string[];
  }, [courtTemplate, templates]);

  const templateWeekdayKeys = useMemo(() => {
    const days = Array.isArray(courtTemplate?.days)
      ? courtTemplate.days
      : templates[0]?.days;
    if (!Array.isArray(days)) return [] as string[];
    return days.map((x: string) => String(x).toLowerCase());
  }, [courtTemplate, templates]);

  const refetchWeekCalendar = useCallback(async () => {
    if (selectedCourt === "all" || !selectedCourt) return;
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const start = format(ws, "yyyy-MM-dd");
    const weekEnd = addDays(ws, 6);
    const end = format(weekEnd, "yyyy-MM-dd");
    try {
      const [data, templateRes, events] = await Promise.all([
        getByCourt(start, end, selectedCourt),
        getTemplateByCourtId(selectedCourt),
        getCourtScheduleEvents(selectedCourt, start, end).catch(() => []),
      ]);
      const { template, linkedTemplateId } = parseCourtTemplateByCourtResponse(templateRes);
      setTimeSlots(Array.isArray(data) ? data : []);
      setCourtTemplate((template as any) ?? null);
      setCourtLinkedTemplateId(linkedTemplateId);
      setEventSlots(Array.isArray(events) ? events : []);
    } catch (err) {
      console.error(err);
    }
  }, [selectedCourt, date]);

  const eventsTabProps = useMemo(
    () => ({
      courts: filteredCourts.length ? filteredCourts : courts,
      initialCourtId: selectedCourt !== "all" ? selectedCourt : undefined,
      templateId: courtLinkedTemplateId,
      templateSlotTimes,
      templateWeekdayKeys,
      onEventsChanged: refetchWeekCalendar,
    }),
    [
      filteredCourts,
      courts,
      selectedCourt,
      courtLinkedTemplateId,
      templateSlotTimes,
      templateWeekdayKeys,
      refetchWeekCalendar,
    ],
  );

  /** Panel "editar plantilla": Eventos si esa plantilla está asignada en alguna cancha (no depende del selector del calendario). */
  const editionEventsTabProps = useMemo(() => {
    const tid = templateToEdit?.id;
    if (!tid) return null;
    const courtsForTpl = courts.filter(
      (c: { id?: string; schedule_template_id?: string | null }) =>
        String(c.schedule_template_id ?? "") === String(tid),
    );
    if (courtsForTpl.length === 0) return null;

    const slotList = Array.isArray(templateToEdit?.slots) ? templateToEdit.slots : [];
    const editionSlotTimes = (slotList as { time?: string }[])
      .map((s) => s?.time)
      .filter(Boolean) as string[];
    const days = Array.isArray(templateToEdit?.days) ? templateToEdit.days : [];
    const editionWeekdayKeys = days.map((x: string) => String(x).toLowerCase());

    const courtIds = courtsForTpl.map((c) => c.id);
    let initialCourtId: string | undefined;
    if (selectedCourt !== "all" && courtIds.includes(selectedCourt)) {
      initialCourtId = selectedCourt;
    } else {
      initialCourtId = courtIds[0];
    }

    return {
      courts: courtsForTpl,
      initialCourtId,
      templateId: tid,
      templateSlotTimes: editionSlotTimes,
      templateWeekdayKeys: editionWeekdayKeys,
      onEventsChanged: refetchWeekCalendar,
    };
  }, [templateToEdit, courts, selectedCourt, refetchWeekCalendar]);

  useEffect(() => {
    if (selectedCourt === "all" || !selectedCourt) return;
    let cancelled = false;
    const fetchAll = async () => {
      setIsCalendarLoading(true);
      const start = format(weekStart, "yyyy-MM-dd");
      const weekEnd = addDays(weekStart, 6);
      const end = format(weekEnd, "yyyy-MM-dd");

      try {
        const [data, templateRes, events] = await Promise.all([
          getByCourt(start, end, selectedCourt),
          getTemplateByCourtId(selectedCourt),
          getCourtScheduleEvents(selectedCourt, start, end).catch(() => []),
        ]);
        if (cancelled) return;
        const { template, linkedTemplateId } = parseCourtTemplateByCourtResponse(templateRes);
        setTimeSlots(Array.isArray(data) ? data : []);
        setCourtTemplate((template as any) ?? null);
        setCourtLinkedTemplateId(linkedTemplateId);
        setEventSlots(Array.isArray(events) ? events : []);
      } catch (err) {
        console.error("Error al obtener horarios", err);
        if (!cancelled) {
          setTimeSlots([]);
          setEventSlots([]);
          setCourtTemplate(null);
          setCourtLinkedTemplateId(null);
        }
      } finally {
        if (!cancelled) setIsCalendarLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [selectedCourt, date]);

  const handleSaveSchedule = async () => {
    setIsLoading(true)
    try{
      const slotsToSend = Array.from(timeSlotsToUpdate.values());
      const slotsNews = slotsToSend.filter((slot)=>(!slot.id))
      const slotsUpdated = slotsToSend.filter((slot)=>(slot.id))
      if (slotsNews.length > 0) await bulkUpdate(slotsNews);
      if (slotsUpdated.length > 0) await bulkUpdate(slotsUpdated);

      // Refrescar calendario desde backend (evita inconsistencias y "lag" visual)
      const start = format(weekStart, "yyyy-MM-dd");
      const weekEnd = addDays(weekStart, 6);
      const end = format(weekEnd, "yyyy-MM-dd");
      const [refreshed, events] = await Promise.all([
        getByCourt(start, end, selectedCourt),
        getCourtScheduleEvents(selectedCourt, start, end).catch(() => []),
      ]);
      setTimeSlots(refreshed);
      setEventSlots(Array.isArray(events) ? events : []);
      setTimeSlotsToUpdate(new Map())
      toast.success("Horarios guardados correctamente");
    }catch(error){
      toast.error("Error al actualizar horarios");
    }finally{
       setIsLoading(false)
    }
    
  };

  const handleApplyTemplate = async(template: any) => {
    setIsLoading(true)
    try{
      const data = await createSchedule(template)
      setTemplates(prev => [...prev, data])
      setIsTemplateSidebarOpen(false);
      toast.success("Plantilla creada correctamente");
    }catch(error){
      toast.error("Error al crear la plantilla");
    }finally{
       setIsLoading(false)
    }
   
  };
  const handleEditTemplate = async (template: any) => {
    setIsLoading(true);
    try {
      const data = await editTemplate({
        id: template.id,
        name: template.name,
        description: template.description,
        days: template.days,
        slots: template.slots,
        venueId: template.venueId,
      });
      setTemplates((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const idx = list.findIndex((t) => t.id === data.id);
        if (idx >= 0) {
          const next = [...list];
          next[idx] = data;
          return next;
        }
        return [data];
      });
      if (
        selectedCourt !== "all" &&
        (courtLinkedTemplateId === data.id || courtTemplate?.id === data.id)
      ) {
        await refetchWeekCalendar();
      }
      setEditionTemplate(false);
      setTemplateToEdit(null);
      toast.success("Plantilla actualizada correctamente");
    } catch (error) {
      toast.error("Error al editar plantilla");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (template: any) => {
    setTemplateToEdit(template);
    setEditionTemplate(true);
  };

  const handleEditionSidebarOpenChange = (open: boolean) => {
    setEditionTemplate(open);
    if (!open) setTemplateToEdit(null);
  };

  const handleSlotStatusChange = async (
    newStatus: statusEnum,
    time: string,
    date: Date,
    slot:any
  ) => {
  try {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${dateStr}-${time}`;
    setTimeSlotsToUpdate((prev) => {
      // Slot existente (tiene id): cualquier cambio vs. su estado actual debe persistirse,
      // incluso si coincide con el "base" de la plantilla (porque en DB está distinto).
      if (slot?.id) {
        if (slot.status === newStatus) {
          prev.delete(key);
          return new Map(prev);
        }
        prev.set(key, { ...slot, status: newStatus });
        return new Map(prev);
      }

      // Slot nuevo: solo guardamos si difiere del estado base
      const baseStatus = getBaseStatus(time, date);
      if (newStatus === baseStatus) {
        prev.delete(key);
        return new Map(prev);
      }
      prev.set(key, { ...slot, status: newStatus });
      return new Map(prev);
    });
    toast.success("Horario actualizado correctamente");
  } catch (error) {
    toast.error("Error al actualizar horario");
    console.error(error);
  }
};
  const handleNewSlotStatusChange = async (
    newStatus: statusEnum,
    time: string,
    date: Date
  ) => {
  try {
    const dateStr = format(date, "yyyy-MM-dd");
    const key = `${dateStr}-${time}`;
    const baseStatus = getBaseStatus(time, date);
    setTimeSlotsToUpdate((prev) => {
      if (newStatus === baseStatus) {
        prev.delete(key);
        return new Map(prev);
      }
      prev.set(key, {
        courtId: selectedCourt,
        templateId: courtTemplate?.id ?? null,
        date: dateStr,
        time,
        status: newStatus,
      });
      return new Map(prev);
    });
    toast.success("Horario actualizado correctamente");
  } catch (error) {
    toast.error("Error al actualizar horario");
    console.error(error);
  }
};

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">
          Gestión de Horarios
        </h2>
        <p className="text-muted-foreground">
          Administra los horarios disponibles de tus canchas.
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Plantilla</CardTitle>
                <Button 
                  variant="outline"
                  onClick={() => setIsTemplateSidebarOpen(true)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Crear Nueva Plantilla
                </Button>
              <FormSidebar
                open={isTemplateSidebarOpen}
                onOpenChange={setIsTemplateSidebarOpen}
                tabs={[
                  {
                    id: "horarios",
                    title: "Crear Plantilla de Horarios",
                    description:
                      "Crea una nueva plantilla de horarios para aplicarla a tus canchas.",
                    content: <ScheduleTemplateForm onSubmit={handleApplyTemplate} />,
                  },
                  ...(courtHasTemplateLinked
                    ? [
                        {
                          id: "eventos" as const,
                          title: "Eventos",
                          description:
                            "Solo disponible cuando la cancha seleccionada en el calendario tiene una plantilla asignada.",
                          content: <EventsTab {...eventsTabProps} />,
                        },
                      ]
                    : []),
                ]}
                defaultTab="horarios"
              />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isTemplatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <ClockIcon className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Cargando plantillas...</span>
              </div>
            ) : templates?.length == 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Es requerido crear una plantilla de horario para la
                disponibilidad de las canchas.
              </div>
            ) : templates?.length > 0 && (<>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      descripcion
                    </th>
                    {/* <th className="px-4 py-3 text-left text-sm font-medium">Dias de la semana</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">horarios</th> */}
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-b">
                      <td className="px-4 py-3 text-sm">{template.name}</td>
                      <td className="px-4 py-3 text-sm">
                        {template.description}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(template)}
                          >
                            <EditIcon className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <FormSidebar
                open={editionTemplate}
                onOpenChange={handleEditionSidebarOpenChange}
                tabs={[
                  {
                    id: "horarios",
                    title: "Editar Plantilla de Horarios",
                    description: "Edita la plantilla general del club",
                    content: templateToEdit ? (
                      <ScheduleTemplateForm
                        key={templateToEdit.id}
                        onSubmit={handleEditTemplate}
                        template={templateToEdit}
                      />
                    ) : null,
                  },
                  ...(editionEventsTabProps
                    ? [
                        {
                          id: "eventos" as const,
                          title: "Eventos",
                          description:
                            "Canchas que tienen esta plantilla asignada. El calendario debajo sigue usando la cancha que elijas allí.",
                          content: <EventsTab {...editionEventsTabProps} />,
                        },
                      ]
                    : []),
                ]}
                defaultTab="horarios"
              />

            </>
             
              
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Calendario de Disponibilidad</CardTitle>
              <CardDescription>
                Visualiza y gestiona los horarios de tus canchas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDate(addDays(date, -7))}
              >
                <ChevronLeftIcon className="h-4 w-4" />
                <span className="sr-only">Semana anterior</span>
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDate(addDays(date, 7))}
              >
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
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas las sedes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sedes</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCourt} onValueChange={handleCourtChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas las canchas" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCourts.map((court) => (
                      court.id ? (
                        <SelectItem key={court.id} value={court.id.toString()}>
                          {court.name}
                        </SelectItem>
                      ) : null
                    // <SelectItem key={court.id} value={court.id.toString()}>
                    //   {court.name}
                    // </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCourt !== "all" && !!selectedCourt && (
              <div className="flex flex-col md:flex-row gap-2 ">
                <Button
                  onClick={handleSaveSchedule}
                  disabled={isLoading || timeSlotsToUpdate.size === 0}
                >
                  {isLoading && <ClockIcon className="mr-2 h-4 w-4 animate-spin" />}
                  <SaveIcon className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            )}
          </div>


          {/* Vista para escritorio */}
          {selectedCourt === "all" || !selectedCourt ? (
            <div className="text-center text-muted-foreground py-4">
              Selecciona una cancha para ver los horarios disponibles.
            </div>
          ) : isCalendarLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <ClockIcon className="h-5 w-5 animate-spin" />
              Cargando calendario...
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-8 gap-2 border-b pb-2">
                    <div className="px-2 py-1 text-sm font-medium">Horario</div>
                    {weekDays.map((day, i) => (
                      <div key={i} className="px-2 py-1 text-center">
                        <div className="text-sm font-medium">
                          {format(day, "EEEE", { locale: es })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(day, "d MMM", { locale: es })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Horarios */}
                  {(() => {
                    // Generar slots basados en la plantilla o horario completo
                    const getTemplateSlots = () => {
                      if (courtTemplate?.slots && courtTemplate.slots.length > 0) {
                        // Ordenar slots por tiempo
                        const sortedSlots = [...courtTemplate.slots].sort((a: any, b: any) =>
                          a.time.localeCompare(b.time)
                        );
                        return sortedSlots.map((slot: any) => slot.time);
                      }
                      // Si aún no hay plantilla cargada, no renderizar filas (evita "doble render" y lag).
                      return [];
                    };

                    const timeSlotsList = getTemplateSlots();
                    return timeSlotsList.map((timeStr: string) => {

                    return (
                      <div
                        key={timeStr}
                        className="grid grid-cols-8 gap-2 border-b py-1"
                      >
                        <div className="flex items-center px-2 text-sm">
                          {timeStr}
                        </div>
                        {weekDays.map((day, i) => {
                          const dateStr = format(day, "yyyy-MM-dd");

                          const matchingSlot = timeSlotsByKey.get(`${dateStr}-${timeStr}`);
                          const cellStatus = resolveCellStatus(dateStr, timeStr, day, matchingSlot);
                          if(matchingSlot){
                            return (
                              <ScheduleTimeSlot
                                key={matchingSlot?.id ?? `${dateStr}-${timeStr}`}
                                status={cellStatus}
                                time={timeStr}
                                date={day}
                                disabled={!isDayEnabledByTemplate(day) || cellStatus === "event"}
                                onStatusChange={(newStatus) =>
                                  handleSlotStatusChange(newStatus, timeStr, day,matchingSlot)
                                }
                              />
                            );
                          }
                          return (
                            <ScheduleTimeSlot
                              key={matchingSlot?.id ?? `${dateStr}-${timeStr}`}
                              status={cellStatus}
                              time={timeStr}
                              date={day}
                              disabled={!isDayEnabledByTemplate(day) || cellStatus === "event"}
                              onStatusChange={(newStatus) =>
                                handleNewSlotStatusChange(newStatus, timeStr, day)
                              }
                            />
                          );
                        
                        })}
                      </div>
                    );
                  })})()}
                </div>
              </div>

              {/* Vista para móvil */}
              {selectedCourt !== "all" && (
                <div className="md:hidden">
                  <div className="space-y-6">
                    {filteredCourts
                      .filter((court) => court.id.toString() === selectedCourt)
                      .map((court) => (
                        <div key={court.id} className="space-y-2">
                          <h3 className="text-lg font-medium">{court.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {court.venue.name}
                          </p>

                          <div className="space-y-4">
                            {weekDays.slice(0, 3).map((day, dayIndex) => (
                              <div key={dayIndex} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {format(day, "EEEE d 'de' MMMM", {
                                      locale: es,
                                    })}
                                  </span>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                  {(courtTemplate?.slots && courtTemplate.slots.length > 0
                                    ? [...courtTemplate.slots].sort((a: any, b: any) => a.time.localeCompare(b.time))
                                    : Array.from({ length: 24 }, (_, i) => ({ time: `${i.toString().padStart(2, "0")}:00` }))
                                  ).map((slot: any) => {
                                    const timeStr = slot.time || slot;
                                    const dateStr = format(day, "yyyy-MM-dd");
                                    const matchingSlot = timeSlotsByKey.get(`${dateStr}-${timeStr}`);
                                    const cellStatus = resolveCellStatus(dateStr, timeStr, day, matchingSlot);

                                    return (
                                      <ScheduleTimeSlot
                                        key={timeStr}
                                        status={cellStatus}
                                        time={timeStr}
                                        date={day}
                                        compact
                                        disabled={!isDayEnabledByTemplate(day) || cellStatus === "event"}
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
              )}
            </>
          )}
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
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-purple-600"></div>
              <span className="text-sm">Evento</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
