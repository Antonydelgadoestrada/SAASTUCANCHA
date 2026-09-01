"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

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
  listCourtScheduleEvents,
} from "@/lib/schedule";
import { getAllCourtsByClub } from "@/lib/courts";
import { FormSidebar } from "@/components/ui/form-sidebar";
import { ScheduleTemplateForm } from "./schedule-template-form";
import { getAllReservation, createReservationManual } from "@/lib/reservation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const searchParams = useSearchParams();
  const courtIdParam = searchParams.get("courtId");
  const [date, setDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [sidebarDefaultTab, setSidebarDefaultTab] = useState<"horarios" | "eventos">("horarios");
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [courtEvents, setCourtEvents] = useState<any[]>([]);
  const [selectedItemDetails, setSelectedItemDetails] = useState<any>(null);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);
  const [selectedSlotForAction, setSelectedSlotForAction] = useState<{ time: string; date: Date } | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);

  // Formulario de reserva manual
  const [bookingUserEmail, setBookingUserEmail] = useState("");
  const [bookingDuration, setBookingDuration] = useState("1");
  const [bookingPrice, setBookingPrice] = useState("");
  const [isBookingSaving, setIsBookingSaving] = useState(false);

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
    const fetchCourts = async () => {
      const data = await getAllCourtsByClub();
      setCourts([...data]);
    };
    fetchCourts();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (courtIdParam && courts.length > 0) {
      const court = courts.find((c) => String(c.id) === String(courtIdParam));
      if (court) {
        setSelectedCourt(String(court.id));
      }
    }
  }, [courtIdParam, courts]);

  const filteredCourts = courts;

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
      const [data, templateRes, events, reservationsRes, eventsListRes] = await Promise.all([
        getByCourt(start, end, selectedCourt),
        getTemplateByCourtId(selectedCourt),
        getCourtScheduleEvents(selectedCourt, start, end).catch(() => []),
        getAllReservation().catch(() => []),
        listCourtScheduleEvents(selectedCourt).catch(() => []),
      ]);
      const { template, linkedTemplateId } = parseCourtTemplateByCourtResponse(templateRes);
      setTimeSlots(Array.isArray(data) ? data : []);
      setCourtTemplate((template as any) ?? null);
      setCourtLinkedTemplateId(linkedTemplateId);
      setEventSlots(Array.isArray(events) ? events : []);
      setAllReservations(Array.isArray(reservationsRes) ? reservationsRes : []);
      setCourtEvents(Array.isArray(eventsListRes) ? eventsListRes : []);
    } catch (err) {
      console.error(err);
    }
  }, [selectedCourt, date]);

  const getBookingSlots = (startTime: string, duration: number) => {
    const [h, m] = startTime.split(":").map(Number);
    const slots: string[] = [];
    let currentMinutes = h * 60 + m;
    const totalSlots = duration * 2;
    for (let i = 0; i < totalSlots; i++) {
      const hh = Math.floor(currentMinutes / 60).toString().padStart(2, "0");
      const mm = (currentMinutes % 60).toString().padStart(2, "0");
      slots.push(`${hh}:${mm}`);
      currentMinutes += 30;
    }
    return slots;
  };

  const isSlotOccupiedByBooking = useCallback((booking: any, dateStr: string, timeStr: string) => {
    if (!booking || booking.status === "CANCELLED" || booking.status === "cancelled") return false;
    const bookingDateStr = new Date(booking.date).toISOString().split("T")[0];
    if (bookingDateStr !== dateStr) return false;
    const times = getBookingSlots(booking.startTime, booking.duration);
    return times.includes(timeStr);
  }, []);

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: "Pendiente",
      PENDING: "Pendiente",
      confirmed: "Confirmado",
      CONFIRMED: "Confirmado",
      completed: "Completado",
      COMPLETED: "Completado",
      cancelled: "Cancelado",
      CANCELLED: "Cancelado",
    };
    return map[status] || status;
  };

  const translatePaymentStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: "Pendiente",
      PENDING: "Pendiente",
      paid: "Pagado",
      PAID: "Pagado",
      rejected: "Rechazado",
      REJECTED: "Rechazado",
      refunded: "Reembolsado",
      REFUNDED: "Reembolsado",
    };
    return map[status] || status;
  };

  const translatePaymentMethod = (method: string) => {
    const map: Record<string, string> = {
      online: "En línea (MercadoPago)",
      manual: "Manual (Efectivo / Transferencia)",
    };
    return map[method] || method;
  };

  const translateRecurrence = (type: string) => {
    const map: Record<string, string> = {
      weekly: "Semanal",
      monthly: "Mensual",
      custom: "Personalizado",
    };
    return map[type] || type;
  };

  const handleCellClick = (
    status: statusEnum,
    time: string,
    date: Date,
    booking?: any,
    eventSlot?: any
  ) => {
    if (status === "occupied" || status === "on-hold") {
      if (booking) {
        setSelectedItemDetails({ type: "booking", data: booking });
        setIsDetailsSidebarOpen(true);
      } else {
        toast.error("No se encontraron detalles para esta reserva.");
      }
    } else if (status === "event") {
      const eventDetail = courtEvents.find(e => e.id === eventSlot?.eventId);
      setSelectedItemDetails({
        type: "event",
        data: eventDetail || { name: eventSlot?.name || "Evento", id: eventSlot?.eventId }
      });
      setIsDetailsSidebarOpen(true);
    } else if (status === "available" || status === "blocked") {
      setSelectedSlotForAction({ time, date });
      setIsActionDialogOpen(true);
    }
  };

  const activeCourtObj = useMemo(() => {
    return courts.find(c => String(c.id) === String(selectedCourt));
  }, [courts, selectedCourt]);

  // Calcular precio sugerido al cambiar duración o cancha
  useEffect(() => {
    if (!selectedSlotForAction || !activeCourtObj) return;
    const hourPrice = Number(activeCourtObj.priceDay || 0);
    const total = hourPrice * Number(bookingDuration);
    setBookingPrice(String(total));
  }, [bookingDuration, selectedSlotForAction, activeCourtObj]);

  const handleSaveManualBooking = async () => {
    if (!selectedSlotForAction) return;
    if (!bookingUserEmail.trim()) {
      toast.error("El email del usuario es obligatorio");
      return;
    }

    setIsBookingSaving(true);
    try {
      const [h, m] = selectedSlotForAction.time.split(":").map(Number);
      const totalMinutesToAdd = Number(bookingDuration) * 60;
      const d = new Date();
      d.setHours(h, m, 0, 0);
      d.setMinutes(d.getMinutes() + totalMinutesToAdd);
      const endHours = d.getHours().toString().padStart(2, "0");
      const endMinutes = d.getMinutes().toString().padStart(2, "0");
      const endTime = `${endHours}:${endMinutes}`;

      const payload = {
        courtId: selectedCourt,
        date: format(selectedSlotForAction.date, "yyyy-MM-dd"),
        startTime: selectedSlotForAction.time,
        endTime,
        duration: Number(bookingDuration),
        price: bookingPrice,
        userEmail: bookingUserEmail,
        pricing: JSON.stringify({
          basePrice: Number(bookingPrice) / Number(bookingDuration),
          discounts: 0,
          taxes: 0,
          totalPrice: Number(bookingPrice)
        })
      };

      await createReservationManual(payload);

      // Limpiar los slots que abarca la reserva de la lista local de pendientes por guardar (timeSlotsToUpdate)
      const bookingSlots = getBookingSlots(selectedSlotForAction.time, Number(bookingDuration));
      const dateStr = format(selectedSlotForAction.date, "yyyy-MM-dd");
      setTimeSlotsToUpdate((prev) => {
        const next = new Map(prev);
        bookingSlots.forEach((slotTime) => {
          next.delete(`${dateStr}-${slotTime}`);
        });
        return next;
      });

      toast.success("Reserva manual registrada exitosamente");
      setIsBookingFormOpen(false);
      setSelectedSlotForAction(null);
      setBookingUserEmail("");
      setBookingDuration("1");
      await refetchWeekCalendar();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || "Error al crear la reserva. Verifica que el email ingresado pertenezca a un usuario registrado.";
      toast.error(msg);
    } finally {
      setIsBookingSaving(false);
    }
  };


  useEffect(() => {
    if (selectedCourt === "all" || !selectedCourt) return;
    let cancelled = false;
    const fetchAll = async () => {
      setIsCalendarLoading(true);
      const start = format(weekStart, "yyyy-MM-dd");
      const weekEnd = addDays(weekStart, 6);
      const end = format(weekEnd, "yyyy-MM-dd");

      try {
        const [data, templateRes, events, reservationsRes, eventsListRes] = await Promise.all([
          getByCourt(start, end, selectedCourt),
          getTemplateByCourtId(selectedCourt),
          getCourtScheduleEvents(selectedCourt, start, end).catch(() => []),
          getAllReservation().catch(() => []),
          listCourtScheduleEvents(selectedCourt).catch(() => []),
        ]);
        if (cancelled) return;
        const { template, linkedTemplateId } = parseCourtTemplateByCourtResponse(templateRes);
        setTimeSlots(Array.isArray(data) ? data : []);
        setCourtTemplate((template as any) ?? null);
        setCourtLinkedTemplateId(linkedTemplateId);
        setEventSlots(Array.isArray(events) ? events : []);
        setAllReservations(Array.isArray(reservationsRes) ? reservationsRes : []);
        setCourtEvents(Array.isArray(eventsListRes) ? eventsListRes : []);
      } catch (err) {
        console.error("Error al obtener horarios", err);
        if (!cancelled) {
          setTimeSlots([]);
          setEventSlots([]);
          setCourtTemplate(null);
          setCourtLinkedTemplateId(null);
          setAllReservations([]);
          setCourtEvents([]);
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
    if (!open) {
      setTemplateToEdit(null);
      setSidebarDefaultTab("horarios");
    }
  };

  const handleTriggerCreateEvent = () => {
    setIsActionDialogOpen(false);
    toast.info("Para gestionar eventos ve a la sección de 'Eventos y Bloqueos' en el menú.");
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
                  }
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

                ]}
                defaultTab={sidebarDefaultTab}
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
                Visualiza y gestiona los horarios de tus canchas. Cada bloque en la cuadrícula representa un intervalo de 30 minutos.
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
                        <div className="flex items-center px-2 text-xs font-semibold text-muted-foreground min-w-[90px]">
                          {(() => {
                            const [hours, minutes] = timeStr.split(":").map(Number);
                            const d = new Date();
                            d.setHours(hours, minutes + 30, 0, 0);
                            const endHours = d.getHours().toString().padStart(2, "0");
                            const endMinutes = d.getMinutes().toString().padStart(2, "0");
                            return `${timeStr} - ${endHours}:${endMinutes}`;
                          })()}
                        </div>
                        {weekDays.map((day, i) => {
                          const dateStr = format(day, "yyyy-MM-dd");

                          const matchingSlot = timeSlotsByKey.get(`${dateStr}-${timeStr}`);
                          const cellStatus = resolveCellStatus(dateStr, timeStr, day, matchingSlot);
                          
                          const bookingForSlot = allReservations.find((b) => 
                            String(b.court?.id) === String(selectedCourt) &&
                            isSlotOccupiedByBooking(b, dateStr, timeStr)
                          );

                          const eventForSlot = eventSlots.find((e) => e.date === dateStr && e.time === timeStr);
                          
                          let finalStatus = cellStatus;
                          if (bookingForSlot) {
                            finalStatus = (bookingForSlot.status === "PENDING" || bookingForSlot.status === "pending") ? "on-hold" : "occupied";
                          } else if (eventForSlot) {
                            finalStatus = "event";
                          }

                          const reservedByName = bookingForSlot 
                            ? bookingForSlot.customerInfo?.name 
                            : eventForSlot 
                              ? `Evento: ${eventForSlot.name}` 
                              : undefined;

                          return (
                            <ScheduleTimeSlot
                              key={matchingSlot?.id ?? `${dateStr}-${timeStr}`}
                              status={finalStatus}
                              time={timeStr}
                              date={day}
                              disabled={!isDayEnabledByTemplate(day)}
                              reservedByName={reservedByName}
                              onClick={(status, time, date) => handleCellClick(status, time, date, bookingForSlot, eventForSlot)}
                              onStatusChange={(newStatus) => {
                                if (matchingSlot) {
                                  handleSlotStatusChange(newStatus, timeStr, day, matchingSlot);
                                } else {
                                  handleNewSlotStatusChange(newStatus, timeStr, day);
                                }
                              }}
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

                                    const bookingForSlot = allReservations.find((b) => 
                                      String(b.court?.id) === String(selectedCourt) &&
                                      isSlotOccupiedByBooking(b, dateStr, timeStr)
                                    );

                                    const eventForSlot = eventSlots.find((e) => e.date === dateStr && e.time === timeStr);
                                    
                                    let finalStatus = cellStatus;
                                    if (bookingForSlot) {
                                      finalStatus = (bookingForSlot.status === "PENDING" || bookingForSlot.status === "pending") ? "on-hold" : "occupied";
                                    } else if (eventForSlot) {
                                      finalStatus = "event";
                                    }

                                    const reservedByName = bookingForSlot 
                                      ? bookingForSlot.customerInfo?.name 
                                      : eventForSlot 
                                        ? `Evento: ${eventForSlot.name}` 
                                        : undefined;

                                    return (
                                      <ScheduleTimeSlot
                                        key={timeStr}
                                        status={finalStatus}
                                        time={timeStr}
                                        date={day}
                                        compact
                                        disabled={!isDayEnabledByTemplate(day)}
                                        reservedByName={reservedByName}
                                        onClick={(status, time, date) => handleCellClick(status, time, date, bookingForSlot, eventForSlot)}
                                        onStatusChange={(newStatus) => {
                                          if (matchingSlot) {
                                            handleSlotStatusChange(newStatus, timeStr, day, matchingSlot);
                                          } else {
                                            handleNewSlotStatusChange(newStatus, timeStr, day);
                                          }
                                        }}
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

      {/* Detalle lateral (Sheet) para reservas u ocupaciones */}
      <Sheet open={isDetailsSidebarOpen} onOpenChange={setIsDetailsSidebarOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedItemDetails?.type === "booking" ? "Detalles de Reserva" : "Detalles del Evento"}
            </SheetTitle>
            <SheetDescription>
              Información completa del horario seleccionado.
            </SheetDescription>
          </SheetHeader>

          {selectedItemDetails?.type === "booking" && (
            <div className="space-y-4 py-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Cliente</span>
                <span className="font-bold text-foreground">{selectedItemDetails.data.customerInfo?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Email</span>
                <span className="font-medium text-foreground">{selectedItemDetails.data.customerInfo?.email || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Teléfono</span>
                <span className="font-medium text-foreground">{selectedItemDetails.data.customerInfo?.phone || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Fecha</span>
                <span className="font-medium text-foreground">
                  {format(new Date(selectedItemDetails.data.date), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Horario</span>
                <span className="font-bold text-primary font-mono">
                  {selectedItemDetails.data.startTime} a {selectedItemDetails.data.endTime} ({selectedItemDetails.data.duration} {selectedItemDetails.data.duration === 1 ? "hora" : "horas"})
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Referencia</span>
                <span className="font-mono text-xs">{selectedItemDetails.data.bookingReference || "N/A"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Estado Reserva</span>
                <span className={`font-bold ${
                  selectedItemDetails.data.status === "CONFIRMED" || selectedItemDetails.data.status === "confirmed"
                    ? "text-green-600"
                    : "text-amber-500"
                }`}>
                  {translateStatus(selectedItemDetails.data.status)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Estado Pago</span>
                <span className={`font-bold ${
                  selectedItemDetails.data.paymentStatus === "PAID" || selectedItemDetails.data.paymentStatus === "paid"
                    ? "text-green-600"
                    : "text-amber-500"
                }`}>
                  {translatePaymentStatus(selectedItemDetails.data.paymentStatus)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Método Pago</span>
                <span className="font-semibold">{translatePaymentMethod(selectedItemDetails.data.paymentMethod)}</span>
              </div>
              <div className="flex justify-between border-b pb-2 pt-2 border-t font-semibold">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Ingreso Total</span>
                <span className="font-extrabold text-primary text-base">S/ {selectedItemDetails.data.pricing?.totalPrice || 0}</span>
              </div>
            </div>
          )}

          {selectedItemDetails?.type === "event" && (
            <div className="space-y-4 py-4 text-sm">
              <div className="flex flex-col border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase mb-1">Nombre del Evento</span>
                <span className="font-bold text-lg text-primary">{selectedItemDetails.data.name}</span>
              </div>
              <div className="flex flex-col border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase mb-1">Descripción</span>
                <span className="font-medium text-foreground">{selectedItemDetails.data.description || "Sin descripción"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Recurrencia</span>
                <span className="font-semibold text-foreground">{translateRecurrence(selectedItemDetails.data.recurrenceType)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="font-semibold text-muted-foreground text-xs uppercase">Costo de Alquiler</span>
                <span className="font-extrabold text-purple-600">
                  {selectedItemDetails.data.price ? `S/ ${selectedItemDetails.data.price}` : "S/ 0.00"}
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Modal para decidir acción del slot */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Administrar Horario</DialogTitle>
            <DialogDescription>
              ¿Qué acción deseas realizar para el día{" "}
              {selectedSlotForAction && format(selectedSlotForAction.date, "EEEE d 'de' MMMM", { locale: es })} a las{" "}
              {selectedSlotForAction?.time}?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              variant="outline"
              className="flex justify-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                setIsActionDialogOpen(false);
                if (selectedSlotForAction) {
                  // Ejecutar comportamiento de bloqueo simple
                  const dateStr = format(selectedSlotForAction.date, "yyyy-MM-dd");
                  const matchingSlot = timeSlotsByKey.get(`${dateStr}-${selectedSlotForAction.time}`);
                  const currentCellStatus = resolveCellStatus(dateStr, selectedSlotForAction.time, selectedSlotForAction.date, matchingSlot);
                  const newStatus: statusEnum = currentCellStatus === "available" ? "blocked" : "available";
                  if (matchingSlot) {
                    handleSlotStatusChange(newStatus, selectedSlotForAction.time, selectedSlotForAction.date, matchingSlot);
                  } else {
                    handleNewSlotStatusChange(newStatus, selectedSlotForAction.time, selectedSlotForAction.date);
                  }
                  setSelectedSlotForAction(null);
                }
              }}
            >
              🔒 Bloqueo simple (Tensionar Disponible / Bloqueado)
            </Button>
            <Button
              variant="outline"
              className="flex justify-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                setIsActionDialogOpen(false);
                setIsBookingFormOpen(true);
              }}
            >
              📅 Registrar Reserva de Cancha (Manual)
            </Button>
            <Button
              variant="outline"
              className="flex justify-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={handleTriggerCreateEvent}
            >
              🏆 Crear Evento o Alquiler recurrente (Academia)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para formulario de reserva manual */}
      <Dialog open={isBookingFormOpen} onOpenChange={setIsBookingFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Reserva Manual</DialogTitle>
            <DialogDescription>
              Completa los detalles para reservar la cancha {activeCourtObj?.name} el día{" "}
              {selectedSlotForAction && format(selectedSlotForAction.date, "EEEE d 'de' MMMM", { locale: es })} a las{" "}
              {selectedSlotForAction?.time}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userEmail">Email del Cliente (Debe estar registrado)</Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="ejemplo@usuario.com"
                value={bookingUserEmail}
                onChange={(e) => setBookingUserEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Duración de la Reserva</Label>
              <Select value={bookingDuration} onValueChange={setBookingDuration}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Selecciona duración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 minutos</SelectItem>
                  <SelectItem value="1.0">1 hora</SelectItem>
                  <SelectItem value="1.5">1.5 horas</SelectItem>
                  <SelectItem value="2.0">2 horas</SelectItem>
                  <SelectItem value="2.5">2.5 horas</SelectItem>
                  <SelectItem value="3.0">3 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Costo sugerido de la reserva (S/)</Label>
              <Input
                id="price"
                type="number"
                value={bookingPrice}
                onChange={(e) => setBookingPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={isBookingSaving}
              onClick={() => {
                setIsBookingFormOpen(false);
                setSelectedSlotForAction(null);
                setBookingUserEmail("");
                setBookingDuration("1");
              }}
            >
              Cancelar
            </Button>
            <Button disabled={isBookingSaving} onClick={handleSaveManualBooking}>
              {isBookingSaving ? "Guardando..." : "Guardar Reserva"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
