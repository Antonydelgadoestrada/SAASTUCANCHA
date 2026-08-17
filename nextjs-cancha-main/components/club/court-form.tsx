"use client"

import { useState, useEffect } from "react"
import { Loader2, X, AlertTriangleIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { sportTypes } from "@/lib/sports"
import { VenueDTO } from "./courts-content"
const durationOptions = [
  { value: "1", label: "1 hora" },
  { value: "1.5", label: "1.5 horas" },
  { value: "2", label: "2 horas" },
]
type CourtFormData = {
  name: string
  venue: { id: number; name: string }
  type: string
  surface: string
  priceDay: number
  minimumBookingTime?: string
  priceNight: number
  promoDay?: number | null
  promoNight?: number | null
  description: string
  schedule_template_id?: string
}

interface Court {
  id: number
  name: string
  venue: {
    id: number
    name: string
    address: string
    [key: string]: any // para evitar errores si vienen más propiedades
  }
  venueId: number
  minimumBookingTime?: string
  type: string
  surface: string
  priceDay: number
  priceNight: number
  promoDay?: number | null
  promoNight?: number | null
  description?: string
  images?: string[]
  image?: string
  address?: string
  location?: {
    address: string
    coordinates: { lat: number; lng: number }
  }
  schedule_template_id?: string

}

type CourtFormProps = {
  // onSubmit: (data: Partial<Court> & { id?: number; images?: string[] }) => void
  onSubmit: (data: any) => void
  venues: Partial<VenueDTO>[]
  // venues: { id: number; name: string; address: string }[]
  court?: Court | null
  onCancel?: () => void
  templates?: any[]
}

export function CourtForm({ onSubmit, venues, court, onCancel, templates }: CourtFormProps) {
  const MAX_FILE_SIZE_MB = 2
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

  const [isLoading, setIsLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isReady, setIsReady] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [newImageUrl, setNewImageUrl] = useState("")
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [showTemplateChangeDialog, setShowTemplateChangeDialog] = useState(false)
  const [tempTemplateId, setTempTemplateId] = useState<string>("")
  const [currentTemplateId, setCurrentTemplateId] = useState<string>("")
  const form = useForm<CourtFormData>({
    defaultValues: {
      name: "",
      minimumBookingTime: '1',
      venue: undefined, // o null
      type: "",
      surface: "",
      priceDay: 0,
      priceNight: 0,
      promoDay: null,
      promoNight: null,
      description: ""
    },
  })

  // Efecto para cargar datos cuando se está editando
  useEffect(() => {
    if (court) {
      const courtImages = court.images || (court.image ? [court.image] : [])
      // setImages(courtImages)

      setExistingImages(courtImages)
      setPreviewUrls([])
      setSelectedFiles([])
      const templateId = court.schedule_template_id || ""
      setCurrentTemplateId(templateId)
      form.reset({
        name: court.name,
        type: court.type,
        venue: court.venue,
        minimumBookingTime: court.minimumBookingTime,
        surface: court.surface,
        priceDay: court.priceDay,
        priceNight: court.priceNight,
        promoDay: court.promoDay,
        promoNight: court.promoNight,
        description: court.description || "",
        schedule_template_id: templateId
      })
      setIsReady(true)
    } else {
      // Resetear formulario para nueva cancha
      setImages([])
      setCurrentTemplateId("")
      form.reset({
        name: "",
        type: "",
        venue: undefined, // o null
        surface: "",
        priceDay: 0,
        priceNight: 0,
        promoDay: null,

        promoNight: null,
        minimumBookingTime: '1',
        description: "",
        schedule_template_id: "",
      })
      setIsReady(true)
    }
  }, [court, form])

  const addImage = () => {
    if (newImageUrl && !images.includes(newImageUrl)) {
      const updatedImages = [...images, newImageUrl]
      setImages(updatedImages)
      setNewImageUrl("")
    }
  }

  const handleTemplateChange = (newTemplateId: string) => {
    // Si es una nueva cancha o no hay plantilla actual, cambiar directamente
    if (!court || !currentTemplateId || currentTemplateId === "") {
      form.setValue("schedule_template_id", newTemplateId)
      setCurrentTemplateId(newTemplateId)
      return
    }

    // Si hay una plantilla actual y es diferente, mostrar modal de confirmación
    if (currentTemplateId && currentTemplateId !== newTemplateId) {
      setTempTemplateId(newTemplateId)
      setShowTemplateChangeDialog(true)
    }
  }

  const confirmTemplateChange = () => {
    form.setValue("schedule_template_id", tempTemplateId)
    setCurrentTemplateId(tempTemplateId)
    setShowTemplateChangeDialog(false)
    setTempTemplateId("")
    toast.warning("Se ha cambiado la plantilla de horario. Las horas, eventos y reservas existentes pueden verse afectadas.")
  }

  const cancelTemplateChange = () => {
    setShowTemplateChangeDialog(false)
    setTempTemplateId("")
  }

  async function handleSubmit(values: CourtFormData) {
    setIsLoading(true)

    try {
      // Incluir las imágenes en los valores
      const dataToSubmit = {
        ...values,
        venue: venues.find((v) => v.id == values.venue.id)!,
        existingImages,
        selectedFiles,
        ...(court && { id: court.id }),
      }

      await onSubmit(dataToSubmit)

      if (!court) {
        // Solo resetear si es una nueva cancha
        form.reset()
        setSelectedFiles([])

        setImages([])
        setNewImageUrl("")
      }
    } catch (error: any) {
      console.error("❌ Error submitting form:", error)

      // Si viene de una petición HTTP (Axios, fetch, etc.)
      const message =
        error?.response?.data?.message || // Axios
        error?.message ||                 // JS genérico
        (typeof error === "string" ? error : "Error desconocido al guardar la cancha")

      toast.error(`Error al guardar la cancha: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    setImages([])
    setNewImageUrl("")
    onCancel?.()
  }
  if (!isReady) return null;
  return (
    <>
      <Form {...form}>
        <form key={court?.id ?? "new"} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Cancha de Fútbol 5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="venue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sede</FormLabel>
                <Select
                  value={field.value?.id?.toString() ?? undefined}
                  onValueChange={(value) => {
                    const selected = venues.find((v) => v.id === parseInt(value))
                    if (selected) field.onChange(selected) // <-- Seteas todo el objeto
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sede" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={`${venue.id}`}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Cancha</FormLabel>
                <Select
                  value={field.value || "futbol"}
                  onValueChange={(value) => field.onChange(value)}
                // onValueChange={field.onChange} value={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {sportTypes.map((sport) => (
                      <SelectItem key={sport.value} value={sport.value}>
                        {sport.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="surface"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Superficie</FormLabel>
                <FormControl>
                  <Input placeholder="Césped sintético" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priceDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Día</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="1" {...field} />
                </FormControl>
                <FormDescription>Precio por 30 minutos en turno día (6 AM - 6 PM)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priceNight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Noche</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="1" {...field} />
                </FormControl>
                <FormDescription>Precio por 30 minutos en turno noche (6 PM - 10 PM)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="promoDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Promocional Día (Opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : Number.parseFloat(e.target.value)
                      field.onChange(value)
                    }}
                  />
                </FormControl>
                <FormDescription>Opcional: Precio promocional para turno día</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="promoNight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Promocional Noche (Opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={field.value === null || field.value === undefined ? "" : field.value}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : Number.parseFloat(e.target.value)
                      field.onChange(value)
                    }}
                  />
                </FormControl>
                <FormDescription>Opcional: Precio promocional para turno noche</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="minimumBookingTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tiempo minimo de reserva</FormLabel>
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange((value))}
                >
                  <FormControl>
                    <SelectTrigger id="duration">
                      <SelectValue placeholder="Seleccionar duración" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {durationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe las características de la cancha..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="schedule_template_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plantilla de Horario</FormLabel>
              <Select
                value={field.value || ""}
                onValueChange={handleTemplateChange}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plantilla de horario" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {templates && templates.length > 0 ? (
                    templates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name || `Plantilla ${template.id}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No hay plantillas disponibles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormDescription>
                Selecciona una plantilla de horario para esta cancha
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4">
          <FormLabel>Imágenes</FormLabel>
          <Input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              if (!e.target.files) return
              const files = Array.from(e.target.files)

              const validFiles: File[] = []
              const validPreviews: string[] = []

              files.forEach((file) => {
                if (file.size > MAX_FILE_SIZE_BYTES) {
                  toast.error(`La imagen "${file.name}" supera los ${MAX_FILE_SIZE_MB}MB permitidos.`)
                } else {
                  validFiles.push(file)
                  validPreviews.push(URL.createObjectURL(file))
                }
              })

              setSelectedFiles((prev) => [...prev, ...validFiles])
              setPreviewUrls((prev) => [...prev, ...validPreviews])
            }}
          // onChange={(e) => {
          //   if (!e.target.files) return
          //   const files = Array.from(e.target.files)
          //   const newPreviews = files.map((file) => URL.createObjectURL(file))
          //   setSelectedFiles((prev) => [...prev, ...files])
          //   setPreviewUrls((prev) => [...prev, ...newPreviews])
          // }}
          />
          <div className="flex flex-wrap gap-4">
            {existingImages.map((url, index) => (
              <div key={`existing-${index}`} className="relative w-24 h-24">
                <img src={url} className="w-full h-full object-cover rounded-md border" />
                <button
                  type="button"
                  onClick={() => {
                    setExistingImages(existingImages.filter((_, i) => i !== index))
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {previewUrls.map((url, index) => (
              <div key={`new-${index}`} className="relative w-24 h-24">
                <img src={url} className="w-full h-full object-cover rounded-md border" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(url)
                    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                    setPreviewUrls((prev) => prev.filter((_, i) => i !== index))
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {court ? "Actualizar Cancha" : "Crear Cancha"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
    <AlertDialog open={showTemplateChangeDialog} onOpenChange={setShowTemplateChangeDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
            Cambiar Plantilla de Horario
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              ¿Estás seguro de que deseas cambiar la plantilla de horario de esta cancha?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm font-medium text-amber-800 mb-1">
                ⚠️ Advertencia importante:
              </p>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>Se perderán todas las horas configuradas</li>
                <li>Los eventos programados serán eliminados</li>
                <li>Las reservas existentes pueden cancelarse</li>
                <li>Se aplicará la nueva configuración de horarios</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelTemplateChange}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmTemplateChange}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Sí, cambiar plantilla
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
