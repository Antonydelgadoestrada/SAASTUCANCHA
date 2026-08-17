"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { GooglePlacesAutocomplete } from "../google-places-autocomplete"

// Servicios disponibles para sedes
const venueServices = [
  { id: "parking", label: "Estacionamiento" },
  { id: "valet", label: "Valet parking" },
  { id: "lockers", label: "Casilleros" },
  { id: "showers", label: "Duchas" },
  { id: "cafeteria", label: "Cafetería" },
  { id: "restaurant", label: "Restaurante" },
  { id: "equipment", label: "Alquiler de equipos" },
  { id: "lighting", label: "Iluminación nocturna" },
  { id: "security", label: "Seguridad 24h" },
  { id: "wifi", label: "WiFi gratuito" },
  { id: "firstaid", label: "Primeros auxilios" },
  { id: "shop", label: "Tienda deportiva" },
  { id: "aircon", label: "Aire acondicionado" },
  { id: "heating", label: "Calefacción" },
  { id: "sound", label: "Sistema de sonido" },
  { id: "scoreboard", label: "Marcador electrónico" },
]

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  phone: z.string().min(7, "El teléfono debe tener al menos 7 caracteres"),
  email: z.string().email("Ingresa un email válido"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  image: z.string().optional(),
  // Nuevos campos detallados
  capacity: z.string().min(1, "Especifica la capacidad"),
  openingHours: z.string().min(5, "Especifica los horarios de atención"),
  services: z.array(z.string()).optional(),
  accessibilityFeatures: z.string().optional(),
  addressReference: z.string().optional(),
  specialInstructions: z.string().optional(),
  location: z.object({
    address: z.string().min(5, { message: "La dirección es requerida" }),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
  }),
})

type VenueFormData = z.infer<typeof formSchema>

export interface Venue {
  id: number
  name: string
  phone: string
  email: string
  description: string
  image?: string
  capacity?: string
  openingHours?: string
  services?: string[]
  accessibilityFeatures?: string
  addressReference?: string
  specialInstructions?: string
  location?: {
    address: string
    coordinates: { lat: number; lng: number }
  }
}

interface VenueFormProps {
  venue?: Venue | null
  onSubmit: (data: VenueFormData & { id?: number }) => void
  onCancel?: () => void
}

export function VenueForm({ venue, onSubmit, onCancel }: VenueFormProps) {
  const MAX_IMAGE_SIZE_MB = 2
  const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

  const [isLoading, setIsLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)


  const form = useForm<VenueFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      description: "",
      image: "",
      capacity: "",
      openingHours: "",
      services: [],
      accessibilityFeatures: "",
      addressReference: "",
      specialInstructions: "",
      location: {
        address:  "",
        coordinates: { lat: 0, lng: 0 },
      },
    },
  })

  // Efecto para cargar datos cuando se está editando
  useEffect(() => {
    if (venue) {
      setImagePreview(venue.image || null)
      form.reset({
        name: venue.name,
        phone: venue.phone,
        email: venue.email,
        description: venue.description,
        image: venue.image || "",
        capacity: venue.capacity || "",
        openingHours: venue.openingHours || "",
        services: venue.services || [],
        accessibilityFeatures: venue.accessibilityFeatures || "",
        addressReference: venue.addressReference || "",
        specialInstructions: venue.specialInstructions || "",
        location: {
          address: venue.location?.address ||  "",
          coordinates: venue.location?.coordinates || { lat: 0, lng: 0 },
        },
      })
    } else {
      // Resetear formulario para nueva sede
      setImagePreview(null)
      form.reset({
        name: "",
        phone: "",
        email: "",
        description: "",
        image: "",
        capacity: "",
        openingHours: "",
        services: [],
        accessibilityFeatures: "",
        addressReference: "",
        specialInstructions: "",
        location: {
          address:  "",
          coordinates: { lat: 0, lng: 0 },
        },
      })
    }
    setIsReady(true)
  }, [venue, form])

  // const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0]
  //   if (file) {
  //     const imageUrl = URL.createObjectURL(file)
  //     setImagePreview(imageUrl)
  //     form.setValue("image", imageUrl)
  //   }
  // }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
  
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(`La imagen supera los ${MAX_IMAGE_SIZE_MB}MB permitidos.`)
      return
    }
  
    const imageUrl = URL.createObjectURL(file)
    setImagePreview(imageUrl)
    form.setValue("image", imageUrl)
  }
  

  const handleImageUrlChange = (url: string) => {
    setImagePreview(url)
    form.setValue("image", url)
  }

  async function handleSubmit(values: VenueFormData) {
    setIsLoading(true)

    // try {
      const dataToSubmit = {
        ...values,
        ...(venue && { id: venue.id }),
      }
      await onSubmit(dataToSubmit)

      if (!venue) {
        // Solo resetear si es una nueva sede
        form.reset()
        setImagePreview(null)
      }
    // } catch (error) {
    //   toast.error("Error al guardar la sede")
    // } finally {
      setIsLoading(false)
    // }
  }

  const handleCancel = () => {
    form.reset()
    setImagePreview(null)
    onCancel?.()
  }
  if (!isReady) return null;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Información Básica */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información Básica</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Sede</FormLabel>
                  <FormControl>
                    <Input placeholder="Sede Central" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidad Total</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 200 personas" {...field} />
                  </FormControl>
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
                    placeholder="Describe las características de la sede, instalaciones disponibles, etc."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Información de Contacto */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información de Contacto</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="Teléfono de contacto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Email de contacto" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Ubicación */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Ubicación</h3>
          <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <GooglePlacesAutocomplete
                    value={field.value?.address || ""}
                    onPlaceSelect={(place, coordinates) => {
                      field.onChange({
                        address: place,
                        coordinates,
                      })

                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>

          <FormField
            control={form.control}
            name="addressReference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Direccion Referencial</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: MegaPlaza" {...field} />
                </FormControl>
                <FormDescription>Describe la direccion referencial</FormDescription>
                <FormMessage />
              </FormItem>
            )} 
          />
        </div>

        {/* Servicios y Facilidades */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Servicios y Facilidades</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="openingHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horarios de Atención</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Lunes a Domingo 6:00 - 22:00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="services"
            render={() => (
              <FormItem>
                <FormLabel>Servicios Disponibles</FormLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {venueServices.map((service) => (
                    <FormField
                      key={service.id}
                      control={form.control}
                      name="services"
                      render={({ field }) => {
                        return (
                          <FormItem key={service.id} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(service.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value ?? []), service.id])
                                    : field.onChange(field.value?.filter((value) => value !== service.id))
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">{service.label}</FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accessibilityFeatures"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Características de Accesibilidad</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Rampas para sillas de ruedas, baños adaptados, ascensor, etc."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Describe las facilidades para personas con discapacidad</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Imagen */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Imagen de la Sede</h3>
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Imagen</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Input
                      placeholder="URL de la imagen"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e.target.value)
                        handleImageUrlChange(e.target.value)
                      }}
                    />
                    <div className="text-center text-sm text-muted-foreground">o</div>
                    <Input type="file" accept="image/*" onChange={handleImageChange} className="cursor-pointer" />
                    {imagePreview && (
                      <div className="mt-2 h-48 w-full overflow-hidden rounded-md border">
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="Vista previa"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Sube una imagen o ingresa la URL de una imagen representativa de la sede.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Instrucciones Especiales */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Información Adicional</h3>
          <FormField
            control={form.control}
            name="specialInstructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instrucciones Especiales</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Ingreso por puerta lateral los fines de semana, código de acceso necesario después de las 20:00, etc."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Información adicional importante para los visitantes</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {venue ? "Actualizar Sede" : "Crear Sede"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
