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
  Smartphone,
  Upload,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  X,
  CreditCardIcon,
  ShieldCheck,
  Trophy,
  Download,
  Maximize2,
} from "lucide-react";
import { QrPreviewModal } from "@/components/ui/qr-preview-modal";
import { downloadImage } from "@/lib/payments";

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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSearchParams } from "next/navigation";
import { getAllCourtsByQuery } from "@/lib/courts";
import { getAllReservationByUser } from "@/lib/reservation";
import { sportTypes } from "@/lib/sports";
import { useRouter } from "next/navigation";
import { createPreference, createReservation } from "@/lib/mercadopago";
import { getWhatsAppLink, uploadPaymentReceipt, createBookingPayment } from "@/lib/payments";

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

export const getEffectivePricing = (court: any, time?: string, durationHours: number | string = 1) => {
  if (!court) {
    return {
      isNight: false,
      slotPrice: 0,
      regularSlotPrice: 0,
      promoSlotPrice: null,
      hasPromo: false,
      regularTotal: 0,
      totalPrice: 0,
      discountAmount: 0,
      advancePercent: 50,
      advanceAmount: 0,
      remainingAmount: 0,
      discountPct: 0,
      hourlyRegularPrice: 0,
      hourlyEffectivePrice: 0,
    };
  }

  const parsedDuration = Number(durationHours) || 1;
  const slotCount = Math.round(parsedDuration * 2); // 30 min por bloque

  // Determinar si el horario seleccionado corresponde a Tarifa Noche (>= 18:00)
  const [h] = (time || "").split(":").map(Number);
  const isNight = !isNaN(h) ? h >= 18 : false;

  // Precio base regular por bloque (30 min)
  const regularSlotPrice = Number(isNight ? (court.priceNight ?? court.price) : (court.priceDay ?? court.price)) || Number(court.price) || 0;

  // Precio promocional por bloque (30 min)
  const promoSlotPrice = Number(isNight ? (court.promoNight ?? court.promoPrice) : (court.promoDay ?? court.promoPrice));
  const hasPromo = !isNaN(promoSlotPrice) && promoSlotPrice > 0 && promoSlotPrice < regularSlotPrice;

  // Precio unitario efectivo
  const effectiveSlotPrice = hasPromo ? promoSlotPrice : regularSlotPrice;

  const regularTotal = Number((regularSlotPrice * slotCount).toFixed(2));
  const totalPrice = Number((effectiveSlotPrice * slotCount).toFixed(2));
  const discountAmount = Math.max(0, Number((regularTotal - totalPrice).toFixed(2)));
  const discountPctVal = hasPromo && regularSlotPrice > 0 ? Math.round(((regularSlotPrice - promoSlotPrice) / regularSlotPrice) * 100) : 0;

  // Porcentaje de adelanto configurado por el club
  const advancePercent = Number(
    court.clubData?.porcentajeAdelantoDefault ??
    court.porcentajeAdelantoDefault ??
    50
  );

  const advanceAmount = Math.max(1, Number(((totalPrice * advancePercent) / 100).toFixed(2)));
  const remainingAmount = Math.max(0, Number((totalPrice - advanceAmount).toFixed(2)));

  return {
    isNight,
    slotPrice: effectiveSlotPrice,
    regularSlotPrice,
    promoSlotPrice: hasPromo ? promoSlotPrice : null,
    hasPromo,
    regularTotal,
    totalPrice,
    discountAmount,
    advancePercent,
    advanceAmount,
    remainingAmount,
    discountPct: discountPctVal,
    hourlyRegularPrice: Number((regularSlotPrice * 2).toFixed(2)),
    hourlyEffectivePrice: Number((effectiveSlotPrice * 2).toFixed(2)),
  };
};

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
  const [playedCourtIds, setPlayedCourtIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("distance");
  const [selectedCourt, setSelectedCourt] = useState<any[0] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState("1");
  const [isLoading, setIsLoading] = useState(false);
  const [bookingData, setBookingData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    notes: "",
  });
  const [duration, setDuration] = useState<string>('1');
  const [payMethod, setPayMethod] = useState<"yape" | "plin" | "mercadopago" | "whatsapp">("yape");
  const [payOption, setPayOption] = useState<"advance" | "full">("advance");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{
    qrUrl?: string | null;
    walletType?: "yape" | "plin";
    titular?: string | null;
    phone?: string | null;
    amount?: number | null;
  }>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successBookingData, setSuccessBookingData] = useState<{
    reference: string;
    courtName: string;
    clubName: string;
    date: string;
    timeRange: string;
    customerPhone: string;
    customerName: string;
    paymentStatus: "PENDIENTE" | "PAGADO" | "ADELANTO" | "PAGO_COMPLETO" | "WHATSAPP_COORDINACION";
    clubPhone?: string;
    clubWhatsApp?: string;
  } | null>(null);

  const getWhatsAppConfirmationMessage = (data: {
    reference: string;
    courtName: string;
    clubName: string;
    date: string;
    timeRange: string;
    customerPhone: string;
    customerName: string;
    paymentStatus: "PENDIENTE" | "PAGADO" | "ADELANTO" | "PAGO_COMPLETO" | "WHATSAPP_COORDINACION";
  }) => {
    if (data.paymentStatus === "WHATSAPP_COORDINACION") {
      return [
        `🏟️ *SOLICITUD DE RESERVA Y COORDINACIÓN POR WHATSAPP*`,
        `🔖 *Código:* ${data.reference}`,
        `⚽ *Cancha:* ${data.courtName}`,
        `🏢 *Club:* ${data.clubName}`,
        `📅 *Fecha:* ${data.date}`,
        `⏰ *Horario:* ${data.timeRange}`,
        `👤 *Cliente:* ${data.customerName} (${data.customerPhone})`,
        `💳 *Estado:* 🟡 *EN COORDINACIÓN (HORARIO BLOQUEADO 2 HORAS)*`,
        ``,
        `🔒 *Aviso:* Mi turno se encuentra bloqueado por 2 horas en TuCancha para evitar doble reserva mientras coordinamos el pago/reserva. Por favor, confirma mi reserva desde tu panel una vez acordemos los detalles. ¡Muchas gracias!`,
      ].join("\n");
    }

    const isPending = data.paymentStatus === "PENDIENTE";
    const lines = [
      `🏟️ *CONFIRMACIÓN DE RESERVA - TUCANCHA*`,
      `🔖 *Código:* ${data.reference}`,
      `⚽ *Cancha:* ${data.courtName}`,
      `🏢 *Club:* ${data.clubName}`,
      `📅 *Fecha:* ${data.date}`,
      `⏰ *Horario:* ${data.timeRange}`,
      `👤 *Cliente:* ${data.customerName} (${data.customerPhone})`,
      `💳 *Estado de Pago:* ${isPending ? "🟡 PENDIENTE DE COMPROBANTE" : "🟢 REGISTRADO / EN REVISIÓN"}`,
    ];

    if (isPending) {
      lines.push(
        ``,
        `⚠️ *ADVERTENCIA IMPORTANTE:*`,
        `Debes subir tu comprobante / voucher de pago dentro de los próximos *15 MINUTOS*.`,
        `De lo contrario, transcurridos los 15 minutos tu reserva será *CANCELADA AUTOMÁTICAMENTE* y el horario quedará liberado.`,
        ``,
        `📲 Puedes adjuntar tu voucher desde la sección *Mis Reservas* en TuCancha o enviarlo directamente.`
      );
    } else {
      lines.push(
        ``,
        `✅ *Tu comprobante ha sido registrado con éxito.* Tu cancha se encuentra reservada.`,
        `Presenta este código al ingresar al complejo deportivo.`
      );
    }

    return lines.join("\n");
  };
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

  // Cargar historial de reservas del usuario para identificar canchas previas ("Ya jugaste aquí")
  useEffect(() => {
    const fetchUserHistory = async () => {
      if (!user) {
        setPlayedCourtIds(new Set());
        return;
      }
      try {
        const userBookings = await getAllReservationByUser();
        if (Array.isArray(userBookings)) {
          const ids = new Set<string>();
          userBookings.forEach((b: any) => {
            if (b.court?.id) ids.add(String(b.court.id));
            if (b.courtId) ids.add(String(b.courtId));
          });
          setPlayedCourtIds(ids);
        }
      } catch (err) {
        // Ignorar silenciosamente si no está logueado o falla la llamada
      }
    };
    fetchUserHistory();
  }, [user]);

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
    setPayMethod("yape");
    setPayOption("advance");
    setReceiptFile(null);
    setReceiptPreview(null);
    setShowBooking(false);
    setShowPayment(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato no válido",
        description: "Por favor selecciona una imagen válida (PNG, JPG, WEBP)",
        variant: "destructive",
      });
      return;
    }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPhone = (phoneText?: string) => {
    if (!phoneText) return;
    navigator.clipboard.writeText(phoneText);
    setCopiedPhone(true);
    toast({
      title: "Número copiado",
      description: `Número ${phoneText} copiado al portapapeles`,
    });
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleSeparate = async () => {
    if (!selectedCourt) return;
    setIsLoading(true);
    try {
      const fecha = format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es });
      const fechaDisplay = selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : format(new Date(), "dd/MM/yyyy", { locale: es });
      
      const timeRange = selectedTime && duration ? (() => {
        const [h, m] = selectedTime.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
        const endH = d.getHours().toString().padStart(2, "0");
        const endM = d.getMinutes().toString().padStart(2, "0");
        return `${selectedTime} a ${endH}:${endM}`;
      })() : selectedTime;

      const newBooking = await createReservation({
        courtId: selectedCourt.id,
        date: fecha,
        startTime: selectedTime,
        duration: Number(duration) || 1,
        userEmail: bookingData.email,
        customerInfo: {
          name: bookingData.name,
          email: bookingData.email,
          phone: bookingData.phone,
          notes: bookingData.notes,
        },
        phone: bookingData.phone,
        name: bookingData.name,
      });

      const bookingRef = newBooking?.bookingReference || newBooking?.data?.bookingReference || `REF-${Date.now()}`;
      const clubPhone = selectedCourt.whatsapp || selectedCourt.phone || selectedCourt.clubData?.phone || selectedCourt.clubData?.whatsapp;

      setSuccessBookingData({
        reference: bookingRef,
        courtName: selectedCourt.name,
        clubName: selectedCourt.club || selectedCourt.venue || selectedCourt.clubData?.name || "Club Deportivo",
        date: fechaDisplay,
        timeRange,
        customerPhone: bookingData.phone,
        customerName: bookingData.name,
        paymentStatus: "PENDIENTE",
        clubPhone: selectedCourt.phone || selectedCourt.whatsapp,
        clubWhatsApp: clubPhone,
      });

      toast({
        title: "¡Cancha separada con éxito!",
        description: `Tu reserva se encuentra PENDIENTE. Tienes 15 minutos para adjuntar tu comprobante de pago.`,
      });

      setShowPayment(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Error al crear la reserva:", error);
      toast({
        title: "Error al separar cancha",
        description: error?.response?.data?.message || "No se pudo registrar la reserva. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedCourt) return;

    if (!user) {
      handleLoginAndContinue();
      return;
    }

    const pricing = getEffectivePricing(selectedCourt, selectedTime, duration);
    const totalPrice = pricing.totalPrice;
    const advanceAmount = pricing.advanceAmount;
    const advancePercent = pricing.advancePercent;
    const payAmount = payOption === "advance" ? advanceAmount : totalPrice;
    const payType = payOption === "advance" ? "ADELANTO" : "PAGO_COMPLETO";

    setIsLoading(true);
    try {
      if (payMethod === "whatsapp") {
        const fecha = format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es });
        const fechaDisplay = selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : format(new Date(), "dd/MM/yyyy", { locale: es });

        const timeRange = selectedTime && duration ? (() => {
          const [h, m] = selectedTime.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
          const endH = d.getHours().toString().padStart(2, "0");
          const endM = d.getMinutes().toString().padStart(2, "0");
          return `${selectedTime} a ${endH}:${endM}`;
        })() : selectedTime;

        const newBooking = await createReservation({
          courtId: selectedCourt.id,
          date: fecha,
          startTime: selectedTime,
          duration: Number(duration) || 1,
          userEmail: bookingData.email,
          paymentMethod: 'whatsapp',
          customerInfo: {
            name: bookingData.name,
            email: bookingData.email,
            phone: bookingData.phone,
            notes: bookingData.notes,
          },
          phone: bookingData.phone,
          name: bookingData.name,
        });

        const bookingId = newBooking?.id || newBooking?.data?.id;
        const bookingRef = newBooking?.bookingReference || newBooking?.data?.bookingReference || `REF-${Date.now()}`;
        const clubPhone = selectedCourt.whatsapp || selectedCourt.phone || selectedCourt.clubData?.phone || selectedCourt.clubData?.whatsapp;

        if (bookingId) {
          await createBookingPayment(bookingId, {
            metodo: "WHATSAPP",
            tipo: "PAGO_COMPLETO",
            monto: totalPrice,
          });
        }

        const successObj = {
          reference: bookingRef,
          courtName: selectedCourt.name,
          clubName: selectedCourt.club || selectedCourt.venue || selectedCourt.clubData?.name || "Club Deportivo",
          date: fechaDisplay,
          timeRange,
          customerPhone: bookingData.phone,
          customerName: bookingData.name,
          paymentStatus: "WHATSAPP_COORDINACION" as const,
          clubPhone: selectedCourt.phone || selectedCourt.whatsapp,
          clubWhatsApp: clubPhone,
        };

        setSuccessBookingData(successObj);

        toast({
          title: "¡Horario bloqueado por 2 horas!",
          description: "Tu turno ha sido bloqueado en el sistema. Coordina directamente con el Club por WhatsApp.",
        });

        // Abrir automáticamente el chat de WhatsApp con el Club
        if (clubPhone) {
          const waMsg = getWhatsAppConfirmationMessage(successObj);
          const waUrl = getWhatsAppLink(clubPhone, waMsg);
          window.open(waUrl, "_blank");
        }

        setShowPayment(false);
        setShowSuccessModal(true);
        return;
      } else if (payMethod === "mercadopago") {
        const { init_point } = await createPreference({
          courtId: selectedCourt.id,
          date: format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es }),
          startTime: selectedTime,
          duration: Number(duration) || 1,
          userEmail: bookingData.email,
        });

        if (init_point) {
          window.location.href = init_point;
          return;
        } else {
          toast({
            title: "Error en pasarela",
            description: "No se pudo iniciar la sesión de Mercado Pago.",
            variant: "destructive",
          });
        }
      } else {
        // Validación de comprobante para Yape / Plin
        if (!receiptFile) {
          toast({
            title: "Comprobante requerido",
            description: `Por favor adjunta la captura de tu comprobante de ${payMethod === "yape" ? "Yape" : "Plin"} antes de continuar.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // 1. Subir captura de comprobante
        const uploadRes = await uploadPaymentReceipt(receiptFile);
        const comprobanteUrl = uploadRes?.url;

        // 2. Crear reserva online
        const fecha = format(selectedDate ?? new Date(), "yyyy-MM-dd", { locale: es });
        const fechaDisplay = selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : format(new Date(), "dd/MM/yyyy", { locale: es });

        const timeRange = selectedTime && duration ? (() => {
          const [h, m] = selectedTime.split(":").map(Number);
          const d = new Date();
          d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
          const endH = d.getHours().toString().padStart(2, "0");
          const endM = d.getMinutes().toString().padStart(2, "0");
          return `${selectedTime} a ${endH}:${endM}`;
        })() : selectedTime;

        const newBooking = await createReservation({
          courtId: selectedCourt.id,
          date: fecha,
          startTime: selectedTime,
          duration: Number(duration) || 1,
          userEmail: bookingData.email,
          customerInfo: {
            name: bookingData.name,
            email: bookingData.email,
            phone: bookingData.phone,
            notes: bookingData.notes,
          },
          phone: bookingData.phone,
          name: bookingData.name,
        });

        const bookingId = newBooking?.id || newBooking?.data?.id;
        const bookingRef = newBooking?.bookingReference || newBooking?.data?.bookingReference || `REF-${Date.now()}`;
        const clubPhone = selectedCourt.whatsapp || selectedCourt.phone || selectedCourt.clubData?.phone || selectedCourt.clubData?.whatsapp;

        // 3. Registrar el pago en el backend
        if (bookingId) {
          await createBookingPayment(bookingId, {
            metodo: payMethod === "yape" ? "YAPE" : "PLIN",
            tipo: payType,
            monto: payAmount,
            comprobanteUrl,
          });
        }

        const remainingText =
          payOption === "advance"
            ? ` (Saldo pendiente a pagar en club: S/ ${(totalPrice - advanceAmount).toFixed(2)})`
            : "";

        setSuccessBookingData({
          reference: bookingRef,
          courtName: selectedCourt.name,
          clubName: selectedCourt.club || selectedCourt.venue || selectedCourt.clubData?.name || "Club Deportivo",
          date: fechaDisplay,
          timeRange,
          customerPhone: bookingData.phone,
          customerName: bookingData.name,
          paymentStatus: payOption === "advance" ? "ADELANTO" : "PAGO_COMPLETO",
          clubPhone: selectedCourt.phone || selectedCourt.whatsapp,
          clubWhatsApp: clubPhone,
        });

        toast({
          title: "¡Comprobante enviado!",
          description: `Tu comprobante de ${payMethod === "yape" ? "Yape" : "Plin"} por S/ ${payAmount} ha sido enviado.${remainingText}`,
        });

        setShowPayment(false);
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      console.error("Error al procesar el pago:", error);
      toast({
        title: "Error al procesar",
        description: error?.response?.data?.message || "No se pudo registrar el pago. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
  

  const displayedCourts = [...filteredCourts].sort((a, b) => {
    const aPlayed = playedCourtIds.has(String(a.id));
    const bPlayed = playedCourtIds.has(String(b.id));

    // Si una cancha fue jugada previamente por el usuario, priorizarla al inicio
    if (aPlayed && !bPlayed) return -1;
    if (!aPlayed && bPlayed) return 1;

    if (sortBy === "price_asc") {
      const priceA = Number(a.promoPrice || a.price || 0);
      const priceB = Number(b.promoPrice || b.price || 0);
      return priceA - priceB;
    }
    if (sortBy === "price_desc") {
      const priceA = Number(a.promoPrice || a.price || 0);
      const priceB = Number(b.promoPrice || b.price || 0);
      return priceB - priceA;
    }
    if (sortBy === "rating") {
      const ratingA = Number(a.rating || 0);
      const ratingB = Number(b.rating || 0);
      return ratingB - ratingA;
    }
    if (sortBy === "distance") {
      const distA = calculateDistance(a);
      const distB = calculateDistance(b);
      return distA - distB;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Controles de ordenamiento */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {displayedCourts.length}{" "}
          {displayedCourts.length === 1
            ? "resultado encontrado"
            : "resultados encontrados"}
          {selectedDate && (
            <span className="ml-2 font-medium">
              para el {format(selectedDate, "dd/MM/yyyy", { locale: es })}
            </span>
          )}
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {playedCourtIds.size > 0 && (
              <SelectItem value="played_first">⭐ Ya jugaste aquí primero</SelectItem>
            )}
            <SelectItem value="distance">Distancia</SelectItem>
            <SelectItem value="rating">Mejor valorados</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resultados */}
      {displayedCourts.length === 0 ? (
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
  {displayedCourts.map((court) => {
    const cardPricing = getEffectivePricing(court, selectedTime, 1);
    const hasPlayedHere = playedCourtIds.has(String(court.id));

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

          {/* Insignia "Ya jugaste aquí" */}
          {hasPlayedHere && (
            <Badge className="absolute left-2 bottom-2 bg-emerald-600/95 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-md backdrop-blur-sm px-2.5 py-1 border border-emerald-400/30">
              <Trophy className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
              Ya jugaste aquí
            </Badge>
          )}

          {/* Tarifa Noche badge */}
          {cardPricing.isNight && (
            <Badge className="absolute right-2 bottom-2 bg-slate-900/90 text-amber-300 border border-amber-400/30 text-[10px] font-semibold">
              🌙 Noche
            </Badge>
          )}

          {/* cintillo de descuento */}
          {cardPricing.hasPromo && (
            <div className="absolute -left-1 top-10 rotate-[-0deg]">
              <div className="bg-red-600 text-white px-6 py-1 text-xs font-semibold shadow-md">
                - {cardPricing.discountPct}% PROMO
              </div>
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <CardTitle className="line-clamp-1">{court.name}</CardTitle>
                {hasPlayedHere && (
                  <span className="shrink-0 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Cancha conocida
                  </span>
                )}
              </div>
              <CardDescription className="line-clamp-1">{court.club}</CardDescription>
            </div>

            {cardPricing.hasPromo && (
              <Badge variant="destructive" className="shrink-0">
                Promo Activa
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

          {/* Información del club y aviso de contacto directo post-reserva */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
            <span className="line-clamp-1 font-medium text-slate-600 dark:text-slate-400">
              {court.venue || court.club || "Complejo Deportivo"}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
              Contacto directo tras reservar
            </span>
          </div>

          {/* rating + precio */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <StarIcon className="h-4 w-4 fill-primary text-primary" />
              <span className="font-medium">5.0</span>
            </div>

            {/* bloque de precio */}
            <div className="text-right">
              {cardPricing.hasPromo ? (
                <div className="flex flex-col items-end">
                  <span className="text-xs line-through text-muted-foreground">
                    S/ {cardPricing.hourlyRegularPrice}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-base text-primary">
                      S/ {cardPricing.hourlyEffectivePrice}
                    </span>
                    <span className="text-xs text-muted-foreground">/ hora</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {cardPricing.isNight ? "🌙 Tarifa Noche con promo" : "☀️ Tarifa Día con promo"}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="font-bold text-base">S/ {cardPricing.hourlyRegularPrice}</span>
                  <span className="text-xs text-muted-foreground">
                    por hora {cardPricing.isNight ? "(🌙 Noche)" : "(☀️ Día)"}
                  </span>
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
                          S/ {selectedCourt.price}/hora
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Ubicación y Contacto</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selectedCourt.address}</span>
                      </div>
                      <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                        <span className="font-semibold">📞 Comunicación Directa:</span> El teléfono y acceso directo a WhatsApp con el Club se activan automáticamente una vez confirmes o separes tu reserva.
                      </div>
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

              {(() => {
                const bookingPricing = getEffectivePricing(selectedCourt, selectedTime, duration);
                return (
                  <div className="space-y-2 p-3.5 bg-muted/60 rounded-xl text-sm border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cancha:</span>
                      <span className="font-semibold">{selectedCourt.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span className="font-medium">
                        {selectedDate
                          ? format(selectedDate, "dd/MM/yyyy", { locale: es })
                          : "Hoy"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horario:</span>
                      <span className="font-medium">
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
                      <span className="text-muted-foreground">Duración y Tarifa:</span>
                      <span className="font-medium">
                        {duration} {duration === "1" ? "hora" : "horas"} ({bookingPricing.isNight ? "🌙 Tarifa Noche" : "☀️ Tarifa Día"})
                      </span>
                    </div>

                    {bookingPricing.hasPromo && (
                      <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 text-xs bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <span className="flex items-center gap-1 font-semibold">
                          🎉 Descuento Promo ({bookingPricing.discountPct}% OFF):
                        </span>
                        <span className="font-bold">- S/ {bookingPricing.discountAmount}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t font-semibold">
                      <span className="text-base">Total a pagar:</span>
                      <div className="text-right">
                        {bookingPricing.hasPromo && (
                          <span className="text-xs line-through text-muted-foreground mr-2">
                            S/ {bookingPricing.regularTotal}
                          </span>
                        )}
                        <span className="text-lg font-bold text-primary">
                          S/ {bookingPricing.totalPrice}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
                <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-400">Aviso importante:</span> Estar 15 min antes en el local para esperar la cancha a la hora reservada. El club no se hace responsable por falta de integrantes de equipo ni demoras por tardanzas internas.
                </AlertDescription>
              </Alert>

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
        <DialogContent className="w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Pagar o Regularizar Reserva</DialogTitle>
            <DialogDescription>
              Completa el pago para confirmar tu turno en {selectedCourt?.name || "la cancha"}.
            </DialogDescription>
          </DialogHeader>

          {selectedCourt && (
            <div className="space-y-4 py-2">
              {/* Resumen de reserva */}
              <div className="rounded-lg bg-muted/60 border p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-base">{selectedCourt.name}</span>
                  <span className="text-emerald-500 font-bold text-base">
                    S/ {selectedCourt.price * (+duration * 2)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center">
                    <MapPinIcon className="mr-2 h-3.5 w-3.5" />
                    <span>{selectedCourt.club || selectedCourt.clubData?.name || "Complejo Deportivo"}</span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="mr-2 h-3.5 w-3.5" />
                    <span>
                      {selectedDate
                        ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
                        : "Hoy"}
                      {selectedTime && duration ? (
                        <span className="ml-1.5 font-medium">
                          {`, ${selectedTime} a ${(() => {
                            const [h, m] = selectedTime.split(":").map(Number);
                            const d = new Date();
                            d.setHours(h, m + parseFloat(duration) * 60, 0, 0);
                            const endH = d.getHours().toString().padStart(2, "0");
                            const endM = d.getMinutes().toString().padStart(2, "0");
                            return `${endH}:${endM}`;
                          })()}`}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="mr-2 h-3.5 w-3.5" />
                    <span>Duración: {duration} {duration === "1" ? "hora" : "horas"}</span>
                  </div>
                </div>
              </div>

              {/* Política de Adelanto del Club */}
              {(() => {
                const payPricing = getEffectivePricing(selectedCourt, selectedTime, duration);
                const advancePercent = payPricing.advancePercent;
                const advanceAmount = payPricing.advanceAmount;
                const remainingAmount = payPricing.remainingAmount;
                const totalPrice = payPricing.totalPrice;

                return (
                  <div className="space-y-2 p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                        <span>📋</span> Política de Reserva del Club
                      </span>
                      <div className="flex items-center gap-1.5">
                        {payPricing.hasPromo && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-bold">
                            Promo -{payPricing.discountPct}%
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-bold">
                          Adelanto {advancePercent}%
                        </Badge>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      El club requiere como mínimo el <strong>{advancePercent}% (S/ {advanceAmount})</strong> para separar tu cancha. Puedes abonar el adelanto ahora y cancelar el saldo restante al ingresar al complejo, o pagar el total.
                      {payPricing.hasPromo && (
                        <span className="block text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                          ✓ Aplicando precio promocional ({payPricing.isNight ? "Tarifa Noche" : "Tarifa Día"}).
                        </span>
                      )}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPayOption("advance")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          payOption === "advance"
                            ? "border-amber-500 bg-amber-500/15 ring-1 ring-amber-500 font-semibold"
                            : "border-border bg-card/60 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Pagar Adelanto ({advancePercent}%)</span>
                          {payOption === "advance" && <Check className="h-3 w-3 text-amber-600" />}
                        </div>
                        <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">
                          S/ {advanceAmount}
                        </p>
                        <span className="text-[10px] text-muted-foreground">Falta en club: S/ {remainingAmount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPayOption("full")}
                        className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          payOption === "full"
                            ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500 font-semibold"
                            : "border-border bg-card/60 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Pagar Total (100%)</span>
                          {payOption === "full" && <Check className="h-3 w-3 text-emerald-600" />}
                        </div>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                          S/ {totalPrice}
                        </p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">100% Pagado</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Selector de métodos de pago */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  MÉTODO DE PAGO / RESERVA:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod("yape")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                      payMethod === "yape"
                        ? "border-[#720e9e] bg-[#720e9e]/10 font-bold text-[#720e9e] dark:text-purple-300 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1 text-[#720e9e] dark:text-purple-400" />
                    <span className="text-xs">Yape</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("plin")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                      payMethod === "plin"
                        ? "border-[#00bcd4] bg-[#00bcd4]/10 font-bold text-[#008ba3] dark:text-cyan-300 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1 text-[#00bcd4]" />
                    <span className="text-xs">Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("mercadopago")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                      payMethod === "mercadopago"
                        ? "border-sky-500 bg-sky-500/10 font-bold text-sky-600 dark:text-sky-400 shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <CreditCardIcon className="h-4 w-4 mb-1 text-sky-500" />
                    <span className="text-xs">Mercado Pago</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("whatsapp")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                      payMethod === "whatsapp"
                        ? "border-[#25D366] bg-[#25D366]/10 font-bold text-[#128C7E] dark:text-[#25D366] shadow-sm"
                        : "border-border hover:border-muted-foreground/40 bg-card"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4 mb-1 fill-[#25D366] text-white" />
                    <span className="text-xs">WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Detalle si es WhatsApp */}
              {payMethod === "whatsapp" && (
                <div className="space-y-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <MessageCircle className="h-4 w-4 fill-emerald-600 text-white" />
                      Coordinación Directa por WhatsApp
                    </span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold">
                      Bloqueo 2 Horas
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Al seleccionar esta opción, tu horario quedará <strong>bloqueado por 2 horas</strong> (en estado <em>on-hold</em>) para que nadie más tome tu turno mientras acuerdas el pago o detalles con el Club por chat.
                  </p>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                    📌 <strong>Confirmación del Administrador:</strong> El club confirmará tu reserva manualmente desde su panel una vez que coordinen por WhatsApp. Si no se confirma en 2 horas, el turno se liberará automáticamente.
                  </div>
                </div>
              )}

              {/* Detalle si es YAPE o PLIN */}
              {(payMethod === "yape" || payMethod === "plin") && (
                <div className="space-y-3.5 p-4 rounded-xl border bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Pago con {payMethod === "yape" ? "Yape" : "Plin"}
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold text-emerald-500 border-emerald-500/40">
                      Monto a transferir: S/ {
                        (() => {
                          const payPricing = getEffectivePricing(selectedCourt, selectedTime, duration);
                          return payOption === "advance" ? payPricing.advanceAmount : payPricing.totalPrice;
                        })()
                      }
                    </Badge>
                  </div>

                  {/* Titular de la cuenta, Número y QR del Club */}
                  {(() => {
                    const titular =
                      payMethod === "yape"
                        ? selectedCourt.clubData?.yapeTitular || (selectedCourt as any).yapeTitular
                        : selectedCourt.clubData?.plinTitular || (selectedCourt as any).plinTitular;
                    const phone =
                      (payMethod === "yape"
                        ? selectedCourt.clubData?.yapeNumero || selectedCourt.yapeNumero
                        : selectedCourt.clubData?.plinNumero || selectedCourt.plinNumero) ||
                      selectedCourt.whatsapp ||
                      selectedCourt.phone ||
                      "987654321";
                    const qrUrl =
                      payMethod === "yape"
                        ? selectedCourt.clubData?.yapeQrUrl || selectedCourt.yapeQrUrl
                        : selectedCourt.clubData?.plinQrUrl || selectedCourt.plinQrUrl;

                    return (
                      <div className="space-y-2.5 pt-1">
                        {/* Titular de la cuenta */}
                        <div className="p-3 bg-purple-500/5 dark:bg-purple-950/20 rounded-xl border border-purple-200/50 dark:border-purple-900/40 flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              Titular de la cuenta ({payMethod === "yape" ? "Yape" : "Plin"}):
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-foreground">
                              {titular || selectedCourt.club || selectedCourt.clubData?.name || "Complejo Deportivo"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-background text-purple-700 dark:text-purple-300 border-purple-200 shrink-0">
                            Verificar nombre
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Número */}
                          <div className="p-3 bg-muted/40 rounded-xl border space-y-1.5 flex flex-col justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              Número de {payMethod === "yape" ? "Yape" : "Plin"}:
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-mono font-bold">{phone}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleCopyPhone(phone)}
                              >
                                {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                <span className="ml-1 text-xs">{copiedPhone ? "Listo" : "Copiar"}</span>
                              </Button>
                            </div>
                          </div>

                          {/* QR */}
                          <div className="p-3 bg-muted/40 rounded-xl border space-y-1.5 flex flex-col justify-between">
                            <span className="text-[11px] text-muted-foreground">Código QR Oficial:</span>
                            {qrUrl ? (
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="relative group h-12 w-12 rounded-lg border overflow-hidden bg-white p-0.5 shrink-0 shadow-sm"
                                  onClick={() => {
                                    setQrModalData({
                                      qrUrl,
                                      walletType: payMethod === "plin" ? "plin" : "yape",
                                      titular,
                                      phone,
                                      amount: payOption === "advance"
                                        ? getEffectivePricing(selectedCourt, selectedTime, duration).advanceAmount
                                        : getEffectivePricing(selectedCourt, selectedTime, duration).totalPrice,
                                    });
                                    setQrModalOpen(true);
                                  }}
                                  title="Hacer clic para ampliar QR para escaneo"
                                >
                                  <img src={qrUrl} alt="QR" className="h-full w-full object-contain group-hover:scale-110 transition-transform" />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Maximize2 className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </button>
                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start"
                                    onClick={() => {
                                      setQrModalData({
                                        qrUrl,
                                        walletType: payMethod === "plin" ? "plin" : "yape",
                                        titular,
                                        phone,
                                        amount: payOption === "advance"
                                          ? getEffectivePricing(selectedCourt, selectedTime, duration).advanceAmount
                                          : getEffectivePricing(selectedCourt, selectedTime, duration).totalPrice,
                                      });
                                      setQrModalOpen(true);
                                    }}
                                  >
                                    <Maximize2 className="h-2.5 w-2.5 mr-1" />
                                    Ampliar QR
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] text-slate-700 hover:text-slate-900 justify-start"
                                    onClick={() =>
                                      downloadImage(
                                        qrUrl,
                                        `QR-${payMethod}-${phone || "cancha"}.png`
                                      )
                                    }
                                  >
                                    <Download className="h-2.5 w-2.5 mr-1" />
                                    Descargar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground text-xs opacity-50 py-1">
                                <QrCode className="h-6 w-6" />
                                <span>Sin QR cargado</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Aviso de tiempo límite de 15 minutos */}
                  <div className="flex items-start sm:items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                    <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
                    <p className="leading-snug">
                      ⏳ <strong>Tienes 15 min</strong> para subir tu comprobante, o el horario se libera automáticamente para otros jugadores.
                    </p>
                  </div>

                  {/* Subida de Comprobante */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold flex items-center gap-1">
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      Captura del Comprobante *
                    </label>

                    {receiptPreview ? (
                      <div className="relative border rounded-xl p-2.5 bg-muted/30 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img src={receiptPreview} alt="Comprobante" className="h-12 w-12 rounded-lg object-cover border" />
                          <div className="truncate">
                            <p className="text-xs font-medium truncate">{receiptFile?.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {receiptFile ? `${(receiptFile.size / 1024).toFixed(1)} KB` : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/5 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
                        <Upload className="h-5 w-5 text-primary mb-1" />
                        <span className="text-xs font-medium text-primary">Subir comprobante de pago</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">Formatos: PNG, JPG, WEBP (Máx. 10MB)</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Detalle si es Mercado Pago */}
              {payMethod === "mercadopago" && (
                <div className="p-3.5 rounded-xl border bg-sky-50/60 dark:bg-sky-950/20 text-xs text-sky-800 dark:text-sky-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CreditCardIcon className="h-4 w-4 text-sky-600" />
                    Pago Inmediato con Mercado Pago
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Serás redirigido a la pasarela segura para pagar con tarjeta de débito o crédito.
                  </p>
                </div>
              )}

              <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200">
                <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs">
                  <span className="font-bold text-amber-700 dark:text-amber-400">Aviso importante:</span> Estar 15 min antes en el local para esperar la cancha a la hora reservada. El club no se hace responsable por falta de integrantes de equipo ni demoras por tardanzas internas.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleSeparate}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Separar Cancha (Pagar después)
                </Button>

                {payMethod === "whatsapp" ? (
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={isLoading}
                    className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white gap-1.5 font-semibold"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4 fill-white text-[#25D366]" />}
                    Bloquear Horario y Coordinar por WhatsApp
                  </Button>
                ) : payMethod === "yape" || payMethod === "plin" ? (
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={isLoading || !receiptFile}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Enviar Comprobante
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirmPayment}
                    disabled={isLoading}
                    className="flex-1 bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCardIcon className="h-4 w-4" />}
                    Pagar con Mercado Pago
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Éxito / Confirmación con Bloqueo y Advertencias */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => {
        if (!open) {
          setShowSuccessModal(false);
          setSelectedCourt(null);
          setSelectedTime("");
          setReceiptFile(null);
          setReceiptPreview(null);
          setBookingData((prev) => ({ ...prev, notes: "" }));
          router.push("/user/bookings");
        }
      }}>
        <DialogContent className="w-[95vw] sm:max-w-[540px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <DialogTitle className="text-xl font-bold">¡Reserva Registrada!</DialogTitle>
            </div>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Tu reserva ha sido procesada. Revisa el estado de tu pago y los detalles a continuación.
            </DialogDescription>
          </DialogHeader>

          {successBookingData && (
            <div className="space-y-4 py-1 text-sm">
              {/* Tarjeta de Resumen */}
              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código de Reserva</span>
                  <Badge variant="outline" className="font-mono font-bold text-xs bg-background shrink-0">
                    {successBookingData.reference}
                  </Badge>
                </div>

                <div className="pt-0.5">
                  <h4 className="font-bold text-base text-foreground break-words">{successBookingData.courtName}</h4>
                  <p className="text-xs text-muted-foreground break-words">{successBookingData.clubName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Fecha:</span>
                    <span className="font-semibold text-foreground">{successBookingData.date}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Horario:</span>
                    <span className="font-semibold text-foreground">{successBookingData.timeRange}</span>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-xs flex-wrap gap-1">
                  <span className="text-muted-foreground">Teléfono registrado:</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                    {successBookingData.customerPhone || "No ingresado"}
                  </span>
                </div>
              </div>

              {/* Estado de Pago y Advertencias */}
              {successBookingData.paymentStatus === "WHATSAPP_COORDINACION" ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-2 text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <MessageCircle className="h-4 w-4 fill-emerald-600 text-white shrink-0" />
                      Estado: EN COORDINACIÓN POR WHATSAPP
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-500 text-emerald-700 dark:text-emerald-300 shrink-0">
                      Bloqueado 2 Horas
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed">
                    🔒 Tu horario se encuentra <strong>bloqueado por 2 horas</strong> en el sistema para que nadie más tome tu turno mientras coordinas con el Club por WhatsApp.
                  </p>
                  <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 font-medium">
                    📌 <strong>Confirmación del Administrador:</strong> El club confirmará tu reserva manualmente desde su panel tras coordinar contigo. Si no se confirma en 2 horas, el turno se liberará automáticamente.
                  </p>
                </div>
              ) : successBookingData.paymentStatus === "PENDIENTE" ? (
                <div className="rounded-xl border border-red-500/30 bg-red-50/80 dark:bg-red-950/30 p-4 space-y-2 text-red-900 dark:text-red-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <span>⚠️</span> Estado de Pago: PENDIENTE
                    </span>
                    <Badge variant="destructive" className="text-[10px] font-bold shrink-0">
                      Tolerancia 15 min
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed">
                    <strong>¡Atención!</strong> Tu reserva está registrada pero <strong>debes subir tu comprobante / voucher de pago dentro de los próximos 15 minutos</strong> desde la sección <em>Mis Reservas</em>.
                  </p>
                  <p className="text-[11px] text-red-700/90 dark:text-red-300/90 font-medium">
                    ⏱️ Si no adjuntas tu comprobante en 15 minutos, tu reserva será <u>cancelada automáticamente</u> y la cancha quedará libre para otros usuarios.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 space-y-1.5 text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span>✅</span> Estado de Pago: COMPROBANTE REGISTRADO
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-500 text-emerald-700 dark:text-emerald-300 shrink-0">
                      En Revisión
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Tu comprobante ha sido enviado con éxito. Tu turno está protegido y asegurado.
                  </p>
                </div>
              )}

              {/* Acceso Directo de Comunicación Desbloqueado */}
              <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 fill-emerald-600 text-white shrink-0" />
                    Acceso de Comunicación Directa Activado
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 shrink-0">
                    Habilitado
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Al haber reservado, ahora dispones del contacto directo con el Club para coordinar o enviar tu confirmación.
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  {(successBookingData.clubWhatsApp || successBookingData.clubPhone) && (
                    <a
                      href={getWhatsAppLink(
                        successBookingData.clubWhatsApp || successBookingData.clubPhone,
                        getWhatsAppConfirmationMessage(successBookingData)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button
                        type="button"
                        className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs gap-1.5 h-10 py-2 whitespace-normal leading-tight"
                      >
                        <MessageCircle className="h-4 w-4 fill-white text-[#25D366] shrink-0" />
                        <span>Enviar Confirmación al Club por WhatsApp</span>
                      </Button>
                    </a>
                  )}

                  {successBookingData.customerPhone && (
                    <a
                      href={getWhatsAppLink(
                        successBookingData.customerPhone,
                        getWhatsAppConfirmationMessage(successBookingData)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-emerald-600/30 text-emerald-700 dark:text-emerald-400 font-semibold text-xs gap-1.5 h-10 py-2 whitespace-normal leading-tight"
                      >
                        <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Abrir en mi WhatsApp ({successBookingData.customerPhone})</span>
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Botón de cierre e ir a Mis Reservas */}
              <div className="pt-1">
                <Button
                  type="button"
                  className="w-full h-10 font-semibold text-xs sm:text-sm"
                  onClick={() => {
                    setShowSuccessModal(false);
                    setSelectedCourt(null);
                    setSelectedTime("");
                    setReceiptFile(null);
                    setReceiptPreview(null);
                    setBookingData((prev) => ({ ...prev, notes: "" }));
                    router.push("/user/bookings");
                  }}
                >
                  Entendido, Ir a Mis Reservas
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para Ampliar y Descargar Código QR */}
      <QrPreviewModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        qrUrl={qrModalData.qrUrl}
        walletType={qrModalData.walletType}
        titular={qrModalData.titular}
        phone={qrModalData.phone}
        amount={qrModalData.amount}
      />
    </div>
  );
}
