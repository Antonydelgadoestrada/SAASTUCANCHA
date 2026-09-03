"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MapPinIcon,
  StarIcon,
  ClockIcon,
  PhoneIcon,
  ChevronLeft,
  ChevronRight,
  UserIcon,
  LogInIcon,
  Loader2,
  MessageCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import { getAllCourtsByQuery } from "@/lib/courts";
import { sportTypes } from "@/lib/sports";
import { useRouter } from "next/navigation";
import { createPreference, createReservation } from "@/lib/mercadopago";
import { getWhatsAppLink } from "@/lib/payments";

interface SearchResultsProps {
  searchQuery?: string;
  selectedSport?: string;
  selectedTeamSize?: string;
  selectedClub?: string;
  selectedPriceRange?: string;
  selectedDate?: Date;
  currentLocation?: { lat: number; lng: number } | null;
  user?: any;
  pendingReservation?: any;
  onClearPendingReservation?: () => void;
}

// const getValidStartTimes = (availableTimes: string[], selectedDuration: string) => {
//   const requiredSlots = {
//     "1": 2,
//     "1.5": 3,
//     "2": 4,
//   }[selectedDuration] || 2

//   const validStartTimes: string[] = []

//   for (let i = 0; i <= availableTimes.length - requiredSlots; i++) {
//     const consecutive = availableTimes.slice(i, i + requiredSlots)

//     const expected = []
//     const base = availableTimes[i]
//     const [h, m] = base.split(":").map(Number)

//     for (let j = 0; j < requiredSlots; j++) {
//       const d = new Date()
//       d.setHours(h, m + j * 30, 0, 0) // 30 min interval
//       expected.push(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`)
//     }

//     if (JSON.stringify(consecutive) === JSON.stringify(expected)) {
//       validStartTimes.push(base)
//     }
//   }

//   return validStartTimes
// }
const formatSoles = (n?: number) =>
  typeof n === "number" && !Number.isNaN(n) ? `S/ ${n.toLocaleString("es-PE")}` : "-";

const hasPromo = (price?: number, promo?: number) =>
  typeof price === "number" &&
  typeof promo === "number" &&
  promo > 0 &&
  promo < price;

const discountPct = (price: number, promo: number) =>
  Math.round(((price - promo) / price) * 100);

const getValidStartTimes = (availableTimes: string[], selectedDuration: string, selectedDate?: Date) => {
  const requiredSlots = {
    "1": 2,
    "1.5": 3,
    "2": 4,
  }[selectedDuration] || 2

  const validStartTimes: string[] = []
  const now = new Date()
  const isToday = !selectedDate || (
    selectedDate.getDate() === now.getDate() && 
    selectedDate.getMonth() === now.getMonth() && 
    selectedDate.getFullYear() === now.getFullYear()
  )

  for (let i = 0; i <= availableTimes.length - requiredSlots; i++) {
    const consecutive = availableTimes.slice(i, i + requiredSlots)
    const base = availableTimes[i]
    const [h, m] = base.split(":").map(Number)

    if (isToday) {
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        continue
      }
    }

    // ✅ Si es 1 hora, solo permitir horarios exactos (ej. 08:00, 09:00)
    if (selectedDuration === "1" && m !== 0) continue

    const expected: string[] = []
    for (let j = 0; j < requiredSlots; j++) {
      const d = new Date()
      d.setHours(h, m + j * 30, 0, 0)
      expected.push(
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
      )
    }

    if (JSON.stringify(consecutive) === JSON.stringify(expected)) {
      validStartTimes.push(base)
    }
  }

  return validStartTimes
}

export  const handleClearFilters = () => {
    setSearchQuery("")
    setSelectedSport("")
    setSelectedTeamSize("")
    setSelectedClub("")
    setSelectedPriceRange("")
    setSelectedDate(undefined)
    setCurrentLocation(null)
    setUseLocation(false)
  }

export function SearchResults({
  searchQuery,
  selectedSport,
  selectedClub,
  selectedPriceRange,
  selectedDate,
  currentLocation,
  user,
  pendingReservation,
  onClearPendingReservation,
}: SearchResultsProps) {
  const router = useRouter()
  const urlSearchParams = useSearchParams();

  const [filteredCourts, setFilteredCourts] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState("distance");
  const [selectedCourt, setSelectedCourt] = useState<any[0] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState("1");
  const [bookingData, setBookingData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    notes: "",
  });
  const [duration, setDuration] = useState<string>('1');
  const filteredtimeOptions = getValidStartTimes(selectedCourt?.availability ?? ['10:00'], duration, selectedDate)
  // console.log({filteredtimeOptions})
  const { toast } = useToast();
  const durationOptions = [
    { value: "1", label: "1 hora" },
    { value: "1.5", label: "1.5 horas" },
    { value: "2", label: "2 horas" },
  ];

  // const filteredOptionsR = durationOptions.filter(
  //   (opt) => parseFloat(opt.value) >= parseFloat(selectedCourt?.minimumBookingTime ?? '1')
  // );
  const getCalculatedHourlyPrice = () => {
    if (!selectedCourt) return 0;
    // Default to day price if no time is selected
    if (!selectedTime) {
      const pDay = Number(selectedCourt.priceDay || 0);
      const prDay = Number(selectedCourt.promoDay || 0);
      return (prDay > 0 ? prDay : pDay) * 2;
    }
    
    const h = parseInt(selectedTime.split(":")[0], 10);
    const isNightTime = h >= 18;
    
    if (isNightTime) {
      const pNight = Number(selectedCourt.priceNight || selectedCourt.priceDay || 0);
      const prNight = Number(selectedCourt.promoNight || selectedCourt.promoDay || 0);
      return (prNight > 0 ? prNight : pNight) * 2;
    } else {
      const pDay = Number(selectedCourt.priceDay || 0);
      const prDay = Number(selectedCourt.promoDay || 0);
      return (prDay > 0 ? prDay : pDay) * 2;
    }
  }

  const getCalculatedTotal = () => {
    const hourly = getCalculatedHourlyPrice();
    const dur = Number(duration) || 0;
    const weeks = isRecurring ? parseInt(recurrenceWeeks, 10) : 1;
    return hourly * dur * weeks;
  }

  const filteredOptions = durationOptions.filter((opt) => {
    const minBooking = parseFloat(selectedCourt?.minimumBookingTime ?? '1')
    const sport = selectedCourt?.sport?.toLowerCase() ?? ""
  
    const isFut = sport.startsWith("fut")
  
    // Si es futbol, permitir solo 1 o 2 horas, pero nunca 1.5
    if (isFut) {
      return parseFloat(opt.value) >= minBooking && opt.value !== "1.5"
    }
  
    // Para otros deportes, permitir todo lo mayor o igual al mínimo
    return parseFloat(opt.value) >= minBooking
  })
  
  // Actualizar datos del usuario cuando cambie
  useEffect(() => {
    if (user) {
      setBookingData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);
  useEffect(() => {
    if (selectedCourt?.minimumBookingTime) {
      setDuration(selectedCourt.minimumBookingTime);
    }
  }, [selectedCourt]);
  
  useEffect(() => {
    setSelectedTime('');
  }, [duration]);

  // Función para calcular distancia (simulada)
  const calculateDistance = (court: any) => {
    if (!currentLocation) return Math.random() * 10;
    const dx = court.coordinates.lat - currentLocation.lat;
    const dy = court.coordinates.lng - currentLocation.lng;
    return Math.sqrt(dx * dx + dy * dy) * 111;
  };

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        const courts = await getAllCourtsByQuery(urlSearchParams.toString());
        setFilteredCourts(courts);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "No se pudieron cargar las canchas.",
          variant: "destructive",
        });
      }
    };
    fetchCourts();
  }, [urlSearchParams]);

  // Sincronizar el court seleccionado cuando se actualizan los resultados (ej. al cambiar la fecha)
  useEffect(() => {
    if (selectedCourt) {
      const updatedCourt = filteredCourts.find((c) => c.id === selectedCourt.id);
      if (updatedCourt) {
        setSelectedCourt(updatedCourt);
      }
    }
  }, [filteredCourts]);

  const handleViewDetails = (court: any) => {
    setSelectedCourt(court);
    setCurrentImageIndex(0);
    setShowDetails(true);
  };

  const handleBookNow = (court: any[0]) => {
    setSelectedCourt(court);
    setShowDetails(false);
    setShowBooking(true); // Siempre mostrar booking primero
  };

  const handleProceedToPayment = () => {
    // Verificar si el usuario está logueado antes de validar datos
    if (!user) {
      setShowBooking(false);
      setShowLoginPrompt(true);
      return;
    }
    if (
      !selectedTime ||
      !bookingData.name ||
      !bookingData.email 
      || !bookingData.phone
    ) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }
    setShowBooking(false);
    setShowPayment(true);
  };
  const handleSeparate = async()=>{
    setIsLoading(true)
    try {
      const fecha = format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es });
      const result = await createReservation({
        courtId: selectedCourt.id,
        date:fecha,
        startTime: selectedTime,
        duration,
        userEmail: bookingData.email,
      });
    
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      // toast.error('Error ')
    }finally{
      setIsLoading(false)
    }
    console.log({
      title: "¡Reserva confirmada!",
      description: `Tu reserva para ${selectedCourt?.name} el ${
        selectedDate
          ? format(selectedDate, "dd/MM/yyyy", { locale: es })
          : "hoy"
      } a las ${selectedTime} ha sido confirmada`,
    })
    toast({
      title: "¡Reserva confirmada!",
      description: `Tu reserva para ${selectedCourt?.name} el ${
        selectedDate
          ? format(selectedDate, "dd/MM/yyyy", { locale: es })
          : "hoy"
      } a las ${selectedTime} ha sido confirmada`,
    });
    setShowPayment(false);

    setSelectedCourt(null);
    setSelectedTime("");
    setBookingData((prev) => ({ ...prev, notes: "" }));
  }
  const handleConfirmPayment = async() => {
    setShowPayment(false);
    try {
    let dates = [];
    if (isRecurring && recurrenceWeeks) {
      const weeks = parseInt(recurrenceWeeks, 10);
      let currentDate = selectedDate || new Date();
      for (let i = 0; i < weeks; i++) {
        dates.push(format(currentDate, "yyyy-MM-dd", { locale: es }));
        let nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 7);
        currentDate = nextDate;
      }
    } else {
      dates = [format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es })];
    }

    const {init_point} = await createPreference({
      courtId: selectedCourt.id, 
      dates: dates,
      startTime:selectedTime, 
      duration, 
      userEmail: bookingData.email,
    })
        // Redireccionar al checkout de Mercado Pago
        if (init_point) {
          window.location.href = init_point;
        } else {
          console.error('No se recibió init_point');
        }
      } catch (error) {
        console.error('Error al crear la reserva:', error);
      }

    toast({
      title: "¡Reserva confirmada!",
      description: `Tu reserva para ${selectedCourt?.name} el ${
        selectedDate
          ? format(selectedDate, "dd/MM/yyyy", { locale: es })
          : "hoy"
      } a las ${selectedTime} ha sido confirmada.`,
    });
    // Reset states
    setSelectedCourt(null);
    setSelectedTime("");
    setBookingData((prev) => ({ ...prev, notes: "" }));
  };

  const nextImage = () => {
    if (selectedCourt) {
      setCurrentImageIndex((prev) => (prev + 1) % selectedCourt.images.length);
    }
  };

  const prevImage = () => {
    if (selectedCourt) {
      setCurrentImageIndex(
        (prev) =>
          (prev - 1 + selectedCourt.images.length) % selectedCourt.images.length
      );
    }
  };

  const handleLoginAndContinue = () => {
    // Guardar datos de reserva en localStorage para continuar después del login
    if (selectedCourt && selectedTime && selectedDate) {
      localStorage.setItem(
        "pendingReservation",
        JSON.stringify({
          courtId: selectedCourt.id,
          date: selectedDate.toISOString(),
          time: selectedTime,
          duration
        })
      );
    }
    setShowLoginPrompt(false);
    const currentUrl = window.location.pathname + window.location.search
    router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`)
  };

  // Manejar reserva pendiente después del login
  useEffect(() => {
    if (user && pendingReservation) {
      const court = filteredCourts.find(
        (c) => c.id === pendingReservation.courtId
      )
      if (court) {
        setSelectedCourt(court)
        setSelectedTime(pendingReservation.time)
        setDuration(pendingReservation.duration || "1") // si la guardaste
        setShowBooking(true)
        onClearPendingReservation?.()
  
        toast({
          title: "Continuando con tu reserva",
          description: `${court.name} - ${pendingReservation.time}`,
        })
      }
    }
  }, [user, pendingReservation, filteredCourts])
  

  return (
    <div className="space-y-6">
      {/* Controles de ordenamiento */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredCourts.length}{" "}
          {filteredCourts.length === 1
            ? "resultado encontrado"
            : "resultados encontrados"}
          {selectedDate && (
            <span className="ml-2 font-medium">
              para el {format(selectedDate, "dd/MM/yyyy", { locale: es })}
            </span>
          )}
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Distancia</SelectItem>
            <SelectItem value="rating">Mejor valorados</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resultados */}
      {filteredCourts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No se encontraron canchas que coincidan con tu búsqueda.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Intenta ajustar los filtros o ampliar tu búsqueda.
            </p>
          </CardContent>
        </Card>
      ) : (
       
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  {filteredCourts.map((court) => {
    const hoursMultiplier = 2;

    const baseUnit = Number(court.priceDay || 0);
    const basePrice = Number.isFinite(baseUnit) && baseUnit > 0 ? baseUnit * hoursMultiplier : undefined;

    const promoUnit = Number(court.promoDay || 0);
    const promo = Number.isFinite(promoUnit) && promoUnit > 0 ? promoUnit * hoursMultiplier : undefined;

    const showPromo = hasPromo(basePrice, promo);
    const pct = showPromo && promo && basePrice ? discountPct(basePrice, promo) : 0;

    return (
      <Card key={court.id} className="overflow-hidden">
        {/* Imagen + cintillos */}
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={court.images?.[0] || "/placeholder.svg"}
            alt={court.name}
            width={400}
            height={225}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />

          {/* deporte */}
          <Badge className="absolute right-2 top-2 bg-background/90 text-foreground">
            {sportTypes.find((s) => s.value === court.sport)?.label}
          </Badge>

          {/* distancia */}
          <Badge className="absolute left-2 top-2 bg-primary/90 text-primary-foreground">
            {calculateDistance(court).toFixed(1)} km
          </Badge>

          {/* cintillo de descuento */}
          {showPromo && (
            <div className="absolute -left-1 top-10 rotate-[-0deg]">
              <div className="bg-red-600 text-white px-6 py-1 text-xs font-semibold shadow-md">
                - {pct}%
              </div>
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="line-clamp-1">{court.name}</CardTitle>
              <CardDescription className="line-clamp-1">{court.club}</CardDescription>
            </div>

            {showPromo && (
              <Badge variant="destructive" className="shrink-0">
                Promo
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* ubicación */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPinIcon className="h-4 w-4" />
            <span className="line-clamp-1">{court.address}</span>
          </div>

          {/* teléfono y whatsapp */}
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <PhoneIcon className="h-4 w-4 text-muted-foreground" />
              <span>{court.phone || "Sin teléfono"}</span>
            </div>

            {(court.whatsapp || court.phone) && (
              <a
                href={getWhatsAppLink(
                  court.whatsapp || court.phone,
                  `¡Hola! Estoy interesado en la cancha "${court.name}" (${court.venue || ""}) que vi en TuCancha.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 transition-colors"
                title="Chatear por WhatsApp con el Club"
              >
                <MessageCircle className="h-3 w-3 fill-emerald-600 dark:fill-emerald-400 text-white" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>

          {/* rating + precio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <StarIcon className="h-4 w-4 fill-primary text-primary" />
              <span className="font-medium">5.0</span>
              {/* <span className="font-medium">{court.rating}</span> */}
              {/* <span className="text-sm text-muted-foreground">({court.reviews})</span> */}
            </div>

            {/* bloque de precio */}
            <div className="text-right">
              {showPromo && promo !== undefined && basePrice !== undefined ? (
                <div className="flex flex-col items-end">
                  <span className="text-sm line-through text-muted-foreground">
                    {formatSoles(basePrice)}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-primary">
                      {formatSoles(promo)}
                    </span>
                    {/* <Badge variant="outline" className="text-[10px]">
                      Ahorra {formatSoles(basePrice - promo)}
                    </Badge> */}
                  </div>
                  <span className="text-sm text-muted-foreground">por hora</span>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="font-semibold">{formatSoles(basePrice)}</span>
                  <span className="text-sm text-muted-foreground">por hora</span>
                </div>
              )}
            </div>
          </div>

          {/* amenities */}
          <div className="flex flex-wrap gap-1">
            {court.amenities.slice(0, 3).map((amenity: string) => (
              <Badge key={amenity} variant="outline" className="text-xs">
                {amenity}
              </Badge>
            ))}
            {court.amenities.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{court.amenities.length - 3} más
              </Badge>
            )}
          </div>

          {/* horarios */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
              <span>Horarios disponibles:</span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {court.availability
                .filter((time: string) => {
                  if (court.sport?.toLowerCase().startsWith("futb") && !time.endsWith(":00")) return false;
                  
                  const now = new Date();
                  const isToday = !selectedDate || (
                    selectedDate.getDate() === now.getDate() && 
                    selectedDate.getMonth() === now.getMonth() && 
                    selectedDate.getFullYear() === now.getFullYear()
                  );
                    
                  if (isToday) {
                    const [h, m] = time.split(":").map(Number);
                    if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
                      return false;
                    }
                  }
                  
                  return true;
                })
                .slice(0, 8)
                .map((time: string) => (
                  <Badge
                    key={time}
                    variant="outline"
                    className="text-xs justify-center py-1"
                  >
                    {time}
                  </Badge>
                ))}

              {court.availability.filter((time: string) => {
                  if (court.sport?.toLowerCase().startsWith("futb") && !time.endsWith(":00")) return false;
                  
                  const now = new Date();
                  const isToday = selectedDate && 
                    selectedDate.getDate() === now.getDate() && 
                    selectedDate.getMonth() === now.getMonth() && 
                    selectedDate.getFullYear() === now.getFullYear();
                    
                  if (isToday) {
                    const [h, m] = time.split(":").map(Number);
                    if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
                      return false;
                    }
                  }
                  
                  return true;
                }).length > 8 && (
                <Badge variant="outline" className="text-xs justify-center py-1">
                  +
                  {court.availability.filter((time: string) => {
                    if (court.sport?.toLowerCase().startsWith("futb") && !time.endsWith(":00")) return false;
                    
                    const now = new Date();
                    const isToday = !selectedDate || (
                      selectedDate.getDate() === now.getDate() && 
                      selectedDate.getMonth() === now.getMonth() && 
                      selectedDate.getFullYear() === now.getFullYear()
                    );
                      
                    if (isToday) {
                      const [h, m] = time.split(":").map(Number);
                      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
                        return false;
                      }
                    }
                    
                    return true;
                  }).length - 8}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleViewDetails(court)}
          >
            Ver detalles
          </Button>
          <Button className="flex-1" onClick={() => handleBookNow(court)}>
            Reservar ahora
          </Button>
        </CardFooter>
      </Card>
    );
  })}
</div>
      )}

      {/* Modal de Login Requerido */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogInIcon className="h-5 w-5" />
              Iniciar Sesión Requerido
            </DialogTitle>
            <DialogDescription>
              Para completar tu reserva de {selectedCourt?.name} el{" "}
              {selectedDate
                ? format(selectedDate, "dd/MM/yyyy", { locale: es })
                : "hoy"}{" "}
              a las {selectedTime}, necesitas iniciar sesión en tu cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <UserIcon className="h-4 w-4" />
              <AlertDescription>
                Si ya tienes una cuenta, inicia sesión para continuar con tu
                reserva. Si no tienes cuenta, puedes registrarte gratis.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLoginPrompt(false)}
              >
                Cancelar
              </Button>
              {/* <Link href="/login" className="flex-1"> */}
                <Button className="w-full" onClick={handleLoginAndContinue}>
                  Iniciar Sesión
                </Button>
              {/* </Link> */}
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Regístrate aquí
                </Link>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalles */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCourt?.name}</DialogTitle>
            <DialogDescription>{selectedCourt?.club}</DialogDescription>
          </DialogHeader>

          {selectedCourt && (
            <div className="space-y-6">
              {/* Carrusel de imágenes */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  src={
                    selectedCourt.images[currentImageIndex] ||
                    "/placeholder.svg"
                  }
                  alt={`${selectedCourt.name} - Imagen ${
                    currentImageIndex + 1
                  }`}
                  width={800}
                  height={400}
                  className="h-full w-full object-cover"
                />

                {selectedCourt.images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-background/80"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      {selectedCourt.images.map((_:any, index: any) => (
                        <button
                          key={index}
                          className={`h-2 w-2 rounded-full ${
                            index === currentImageIndex
                              ? "bg-primary"
                              : "bg-background/80"
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Información General</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deporte:</span>
                        <span>
                          {
                            sportTypes.find(
                              (s) => s.value === selectedCourt.sport
                            )?.label
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Superficie:
                        </span>
                        <span>{selectedCourt.surface}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Capacidad:
                        </span>
                        
                        <span>{selectedCourt.capacity ? <>{selectedCourt.capacity} jugadores</>: <></>}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio:</span>
                        <span className="font-semibold">
                          S/ {getCalculatedHourlyPrice()}/hora
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Contacto</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedCourt.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedCourt.phone || "No especificado"}</span>
                      </div>

                      {(selectedCourt.whatsapp || selectedCourt.phone) && (
                        <div className="pt-2">
                          <a
                            href={getWhatsAppLink(
                              selectedCourt.whatsapp || selectedCourt.phone,
                              `¡Hola! Quisiera consultar sobre la cancha "${selectedCourt.name}" (${selectedCourt.venue || ""}) que vi en TuCancha.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-full"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border-[#25D366]/30 font-semibold text-xs gap-2 h-9"
                            >
                              <MessageCircle className="h-4 w-4 fill-[#25D366] text-white" />
                              Contactar al WhatsApp del Club
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Servicios Incluidos</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourt.amenities.map((amenity: any) => (
                        <Badge key={amenity} variant="secondary">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Valoración</h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {Array(5)
                          .fill(null)
                          .map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.floor(selectedCourt.rating)
                                  ? "fill-primary text-primary"
                                  : "fill-muted text-muted"
                              }`}
                            />
                          ))}
                      </div>
                      <span className="font-semibold">
                        {selectedCourt.rating}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({selectedCourt.reviews} reseñas)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Descripción</h3>
                <p className="text-muted-foreground">
                  {selectedCourt.description}
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Cerrar
                </Button>
                <Button onClick={() => handleBookNow(selectedCourt)}>
                  Ver disponibilidad
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Reserva */}
      <Dialog open={showBooking} onOpenChange={setShowBooking}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reservar {selectedCourt?.name}</DialogTitle>
            <DialogDescription>{selectedCourt?.club}</DialogDescription>
          </DialogHeader>

          {selectedCourt && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Fecha seleccionada</Label>
                  <div className="mt-2 p-1 bg-muted rounded-lg">
                    <Input 
                      type="date" 
                      value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => {
                        const newParams = new URLSearchParams(urlSearchParams.toString());
                        newParams.set('date', e.target.value);
                        router.push(`${window.location.pathname}?${newParams.toString()}`);
                      }}
                      className="bg-transparent border-0 font-medium"
                    />
                  </div>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <Label htmlFor="duration">Duración</Label>
                    {/* <span>{selectedCourt?.minimumBookingTime}</span> */}
                    <Select
                      value={duration}
                      onValueChange={setDuration}
                      disabled={!selectedCourt && !selectedDate}
                    >
                      <SelectTrigger id="duration">
                        <SelectValue placeholder="Seleccionar duración" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                  </div>
                </div>
                <div>
                  <Label>Horarios disponibles</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {filteredtimeOptions.map((time: any) => {
                      const [h, m] = time.split(":").map(Number);
                      const d = new Date();
                      d.setHours(h, m + Number(duration) * 60, 0, 0);
                      const endTime = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                      return (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                      >
                        {time} - {endTime}
                      </Button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Reserva Recurrente</h3>
                    <p className="text-xs text-muted-foreground">Reservar automáticamente el mismo día en las próximas semanas</p>
                  </div>
                  <Switch
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>
                {isRecurring && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="recurrence">Repetir por</Label>
                      <Select
                        value={recurrenceWeeks}
                        onValueChange={setRecurrenceWeeks}
                      >
                        <SelectTrigger id="recurrence">
                          <SelectValue placeholder="Seleccionar periodo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 semanas</SelectItem>
                          <SelectItem value="3">3 semanas</SelectItem>
                          <SelectItem value="4">1 mes (4 semanas)</SelectItem>
                          <SelectItem value="8">2 meses (8 semanas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Datos del reservante</h3>
                {!user && (
                  <Alert>
                    <LogInIcon className="h-4 w-4" />
                    <AlertDescription>
                      Selecciona un horario y luego inicia sesión para completar
                      tu reserva.
                    </AlertDescription>
                  </Alert>
                )}
                {user && (
                  <Alert>
                    <UserIcon className="h-4 w-4" />
                    <AlertDescription>
                      Tus datos han sido pre-llenados desde tu perfil. Puedes
                      modificarlos si es necesario.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Nombre completo *</Label>
                    <Input
                      id="name"
                      value={bookingData.name}
                      onChange={(e) =>
                        setBookingData({ ...bookingData, name: e.target.value })
                      }
                      placeholder="Tu nombre completo"
                      disabled={!user}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={bookingData.email}
                      onChange={(e) =>
                        setBookingData({
                          ...bookingData,
                          email: e.target.value,
                        })
                      }
                      placeholder="tu@email.com"
                      disabled={!user}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    value={bookingData.phone}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, phone: e.target.value })
                    }
                    placeholder="+51 999 999 999"
                    disabled={!user}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notas adicionales</Label>
                  <Textarea
                    id="notes"
                    value={bookingData.notes}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, notes: e.target.value })
                    }
                    placeholder="Comentarios o solicitudes especiales..."
                    disabled={!user}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Cancha:</span>
                  <span>{selectedCourt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha:</span>
                  <span>
                    {selectedDate
                      ? format(selectedDate, "dd/MM/yyyy", { locale: es })
                      : "Hoy"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hora de Inicio:</span>
                  <span>{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horario:</span>
                  <span>
                    {selectedTime && duration
                      ? `${selectedTime} a ${(() => {
                          const [h, m] = selectedTime.split(":").map(Number);
                          const d = new Date();
                          d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
                          const endH = d.getHours().toString().padStart(2, "0");
                          const endM = d.getMinutes().toString().padStart(2, "0");
                          return `${endH}:${endM}`;
                        })()}`
                      : selectedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Horas por fecha:</span>
                  <span>{duration} hrs</span>
                </div>
                {isRecurring && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>Fechas totales:</span>
                    <span>x {recurrenceWeeks}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>S/ {getCalculatedTotal()}</span>
                </div>
              </div>

              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
                <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-400">Aviso importante:</span> Estar 15 min antes en el local para esperar la cancha a la hora reservada. El club no se hace responsable por falta de integrantes de equipo ni demoras por tardanzas internas.
                </AlertDescription>
              </Alert>

              {(selectedCourt.whatsapp || selectedCourt.phone) && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs">
                  <span className="text-slate-600 dark:text-slate-300">¿Dudas con tu reserva?</span>
                  <a
                    href={getWhatsAppLink(
                      selectedCourt.whatsapp || selectedCourt.phone,
                      `¡Hola! Tengo una consulta sobre mi reserva para la cancha "${selectedCourt.name}" el ${
                        selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : "día de hoy"
                      } a las ${selectedTime || ""}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                    Chatear por WhatsApp
                  </a>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowBooking(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleProceedToPayment}>
                  {user ? "Proceder al pago o Reserva" : "Iniciar sesión para reservar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Pago */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Procesar Pago</DialogTitle>
            <DialogDescription>Completa tu reserva</DialogDescription>
          </DialogHeader>

          {selectedCourt && (
            <div className="space-y-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Cancha:</span>
                  <span>{selectedCourt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha:</span>
                  <span>
                    {selectedDate
                      ? format(selectedDate, "dd/MM/yyyy", { locale: es })
                      : "Hoy"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hora de Inicio:</span>
                  <span>{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horario:</span>
                  <span>
                    {selectedTime && duration
                      ? `${selectedTime} a ${(() => {
                          const [h, m] = selectedTime.split(":").map(Number);
                          const d = new Date();
                          d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
                          const endH = d.getHours().toString().padStart(2, "0");
                          const endM = d.getMinutes().toString().padStart(2, "0");
                          return `${endH}:${endM}`;
                        })()}`
                      : selectedTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Duracion:</span>
                  <span>{duration} hrs</span>
                </div>
                {isRecurring && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>Fechas totales:</span>
                    <span>x {recurrenceWeeks}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total a pagar:</span>
                  <span>S/ {getCalculatedTotal()}</span>
                </div>
              </div>

              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
                <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-400">Aviso importante:</span> Estar 15 min antes en el local para esperar la cancha a la hora reservada. El club no se hace responsable por falta de integrantes de equipo ni demoras por tardanzas internas.
                </AlertDescription>
              </Alert>

              {(selectedCourt.whatsapp || selectedCourt.phone) && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs">
                  <span className="text-slate-600 dark:text-slate-300">¿Dudas con el pago?</span>
                  <a
                    href={getWhatsAppLink(
                      selectedCourt.whatsapp || selectedCourt.phone,
                      `¡Hola! Tengo una consulta sobre el pago de mi reserva para la cancha "${selectedCourt.name}".`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5 fill-emerald-600 text-white" />
                    WhatsApp del Club
                  </a>
                </div>
              )}

              <div className="mt-4 flex gap-4">
                <Button variant="outline" onClick={handleSeparate} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Separar Cancha
                </Button>
                <Button onClick={handleConfirmPayment} disabled={isLoading}>
                  Proceder a Pagar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
