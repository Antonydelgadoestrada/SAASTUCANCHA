"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, ClockIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DialogFooter } from "@/components/ui/dialog"
import { getByCourt } from "@/lib/schedule"
import { toast } from "sonner"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"


export const reservationSchema = z.object({

  courtId: z.string().min(1, { message: "Selecciona una cancha." }),
  date: z.date({ required_error: "Selecciona una fecha válida." }),
  duration: z.string().min(1, { message: "Selecciona duración." }),
  startTime: z.string().min(1, { message: "Selecciona una hora." }),
  userEmail: z.string().email({ message: "Correo no válido." }),
  price: z.coerce.number().positive({ message: "Precio inválido." }),
  proof: z
  .any()
  .refine(
    (file) => file instanceof File || file === undefined || file === null,
    { message: "Archivo inválido." }
  )
  .optional()
  .nullable()
})
type ReservationFormValues = z.infer<typeof reservationSchema>

interface ReservationFormProps {

  courts: any[]
  isSubmitting:boolean
  onSubmit: (data:any) => void
}

const getValidStartTimes = (availableTimes: string[], selectedDuration: string, selectedDate?: Date) => {
  const requiredSlots = {
    "1": 2,
    "1.5": 3,
    "2": 4,
  }[selectedDuration] || 2

  const validStartTimes: string[] = []
  const now = new Date()
  const isToday = selectedDate && 
    selectedDate.getDate() === now.getDate() && 
    selectedDate.getMonth() === now.getMonth() && 
    selectedDate.getFullYear() === now.getFullYear()

  for (let i = 0; i <= availableTimes.length - requiredSlots; i++) {
    const consecutive = availableTimes.slice(i, i + requiredSlots)
    const base = availableTimes[i]
    const [h, m] = base.split(":").map(Number)

    if (isToday) {
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        continue
      }
    }

    const expected = []
    for (let j = 0; j < requiredSlots; j++) {
      const d = new Date()
      d.setHours(h, m + j * 30, 0, 0) // 30 min interval
      expected.push(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`)
    }

    if (JSON.stringify(consecutive) === JSON.stringify(expected)) {
      validStartTimes.push(base)
    }
  }

  return validStartTimes
}


export function ReservationForm({ courts, onSubmit, isSubmitting }: ReservationFormProps) {
  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {

      courtId: "",
      date: undefined,
      duration: "",
      startTime: "",
      userEmail: "",
      price: 0,
      proof: undefined,
    },
  })
  
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  const [selectedCourt, setSelectedCourt] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [startTime, setStartTime] = useState<string>("")
  const [duration, setDuration] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [price, setPrice] = useState<string>("0")
  const [timeOptions, setTimeOptions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filtrar canchas según la sede seleccionada
  const filteredCourts = courts
  const filteredtimeOptions = getValidStartTimes(timeOptions, duration, selectedDate)
  // Opciones de duración
  const durationOptions = [
    { value: "1", label: "1 hora" },
    { value: "1.5", label: "1.5 horas" },
    { value: "2", label: "2 horas" },
  ]

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedCourt || !selectedDate) return;
  
      const formattedDate = selectedDate.toISOString().split("T")[0];
  
      try {
        const result = await getByCourt(formattedDate,formattedDate,selectedCourt)
  
        const availableTimes = result
          .filter((slot:any) => slot.status == "available")
          .map((slot:any) => slot.time);
        setTimeOptions(availableTimes);
      } catch (err) {
        toast("Error al traer disponibilidad");
      }
    };
    fetchAvailability();
  }, [selectedCourt, selectedDate]);

  // Autocompletar el precio basado en la cancha, duración y hora
  useEffect(() => {
    if (selectedCourt && duration) {
      const courtObj = courts.find(c => c.id === selectedCourt || c.id === parseInt(selectedCourt));
      if (courtObj) {
        let basePrice = Number(courtObj.priceDay) || 0;
        let promoPrice = Number(courtObj.promoDay) || 0;
        if (startTime) {
          const [h] = startTime.split(":").map(Number);
          if (h >= 18) {
            basePrice = Number(courtObj.priceNight) || basePrice;
            promoPrice = Number(courtObj.promoNight) || 0;
          }
        }
        const unitPrice = promoPrice > 0 && promoPrice < basePrice ? promoPrice : basePrice;
        const total = unitPrice * parseFloat(duration);
        setPrice(total.toString());
      }
    } else {
      setPrice("0");
    }
  }, [selectedCourt, duration, startTime, courts]);

  // Calcular hora de fin
  const calculateEndTime = () => {
    if (!startTime) return ""

    const [hours, minutes] = startTime.split(":").map(Number)
    const durationHours = Number.parseFloat(duration)

    const startDate = new Date()
    startDate.setHours(hours, minutes, 0, 0)

    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000)
    return `${endDate.getHours().toString().padStart(2, "0")}:${endDate.getMinutes().toString().padStart(2, "0")}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    setIsLoading(true)
    e.preventDefault()
    await onSubmit({

      courtId:selectedCourt,
      date:selectedDate?.toISOString() || "",
      startTime,
      duration: parseFloat(duration) || 1,
      userEmail,
      "endTime":calculateEndTime(),
      pricing:{"taxes": 0, "basePrice": price, "discounts": 0, "totalPrice": price},
      image:proofFile
    })
    setIsLoading(false)
  }
  

  return (  
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="space-y-2">
            <Label htmlFor="court">Cancha</Label>
            <Select value={selectedCourt} onValueChange={setSelectedCourt}>
              <SelectTrigger id="court">
                <SelectValue placeholder="Seleccionar cancha" />
              </SelectTrigger>
              <SelectContent>
                {filteredCourts.map((court) => (
                  <SelectItem key={court.id} value={`${court.id}`}>
                    {court.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2" >
            <Label htmlFor="duration">Duración</Label>
            <Select value={duration} onValueChange={setDuration} disabled={!selectedCourt || !selectedDate}>
              <SelectTrigger id="duration">
                <SelectValue placeholder="Seleccionar duración" />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-time">Hora de inicio</Label>
            {!selectedCourt || !selectedDate || !duration ? (
              <div className="text-sm text-muted-foreground italic py-2">
                Selecciona cancha, fecha y duración
              </div>
            ) : filteredtimeOptions.length > 0 ? (
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="start-time">
                  <SelectValue placeholder="Seleccionar hora" />
                </SelectTrigger>
                <SelectContent>
                  {filteredtimeOptions.map((time) => {
                    const [h, m] = time.split(":").map(Number);
                    const d = new Date();
                    d.setHours(h, m + Number(duration) * 60, 0, 0);
                    const endTime = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                    return (
                    <SelectItem key={time} value={time}>
                      {time} - {endTime}
                    </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-destructive font-medium italic py-2">
                No hay horarios disponibles para esta fecha y hora
              </div>
            )}
          </div>

         
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Horario</Label>
            <span className="text-sm text-muted-foreground">
              {startTime} - {calculateEndTime()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Precio (S/)</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="proof">Adjuntar comprobante (opcional)</Label>
          <Input
            id="proof"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setProofFile(file)
            
              if (file) {
                const url = URL.createObjectURL(file)
                setPreviewUrl(url)
              } else {
                setPreviewUrl('')
              }
            }}
          />
          {previewUrl && (
              <div className="mt-2 flex items-center gap-4">
                {proofFile?.type.includes('pdf') ? (
                      <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      Ver PDF
                    </a>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="w-32 h-32 object-contain border rounded"
                  />
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setProofFile(null)
                    setPreviewUrl('')
                  }}
                >
                  Eliminar
                </Button>
              </div>
              )}


        </div>
      </div>

      <DialogFooter>
        <Button 
          type="submit"
          disabled={isLoading}
        >
          {isLoading && <ClockIcon className="mr-2 h-4 w-4 animate-spin" />}
          Crear Reserva
          </Button>
      </DialogFooter>
    </form>
  )
}
