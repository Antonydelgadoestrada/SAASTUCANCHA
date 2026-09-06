"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { registerUser } from "@/lib/auth"
import { GooglePlacesAutocomplete } from "../google-places-autocomplete"
import { signIn } from "next-auth/react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Esquema para usuario normal
const userFormSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  email: z.string().email({
    message: "Por favor ingresa un correo electrónico válido.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
  phone: z.string().min(6, {
    message: "Por favor ingresa un número de teléfono válido.",
  }),
  role: z.literal("USER"),
})

// Esquema extendido para club deportivo
const clubFormSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre del club debe tener al menos 2 caracteres.",
  }),
  email: z.string().email({
    message: "Por favor ingresa un correo electrónico válido.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
  role: z.literal("CLUB"),
  phone: z.string().min(6, {
    message: "Por favor ingresa un número de teléfono válido.",
  }),
  address: z.string().min(3, {
    message: "Por favor ingresa la dirección de tu club.",
  }),
  district: z.string().optional().or(z.literal("")),
  description: z
    .string()
    .min(5, {
      message: "Por favor proporciona una descripción de al menos 5 caracteres.",
    })
    .max(500, {
      message: "La descripción no puede exceder los 500 caracteres.",
    }),
  website: z.string().optional().or(z.literal("")),
  foundedYear: z.string().optional().or(z.literal("")),
  openingHours: z.string().optional().or(z.literal("")),
  services: z.string().optional(),
  facebookUrl: z.string().optional().or(z.literal("")),
  instagramUrl: z.string().optional().or(z.literal("")),
  twitterUrl: z.string().optional().or(z.literal("")),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
})

export type UserFormValues = z.infer<typeof userFormSchema>
export type ClubFormValues = z.infer<typeof clubFormSchema>

export function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultType = searchParams.get("type") === "club" ? "CLUB" : "USER"

  const [isLoading, setIsLoading] = useState(false)
  const [showGoogleLoading, setShowGoogleLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"USER" | "CLUB">(defaultType)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [showClubWelcomeDialog, setShowClubWelcomeDialog] = useState(false)

  // Servicios disponibles
  const availableServices = [
    { id: "parking", label: "Estacionamiento" },
    { id: "lockers", label: "Casilleros" },
    { id: "showers", label: "Duchas" },
    { id: "cafeteria", label: "Cafetería" },
    { id: "equipment", label: "Alquiler de equipos" },
    { id: "lighting", label: "Iluminación nocturna" },
    { id: "security", label: "Seguridad 24h" },
    { id: "wifi", label: "WiFi gratuito" },
    { id: "firstaid", label: "Primeros auxilios" },
    { id: "shop", label: "Tienda deportiva" },
  ]

  // Formulario para usuario normal
  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      role: "USER",
    },
  })

  // Formulario para club deportivo
  const clubForm = useForm<ClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "CLUB",
      phone: "",
      address: "",
      district: "",
      description: "",
      website: "",
      foundedYear: "",
      openingHours: "",
      services: "",
      facebookUrl: "",
      instagramUrl: "",
      twitterUrl: "",
      coordinates: undefined,
    },
  })

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices([...selectedServices, serviceId])
    } else {
      setSelectedServices(selectedServices.filter((id) => id !== serviceId))
    }
  }

  const handleLocationSelect = (place: string, coordinates: { lat: number; lng: number; }) => {
    setSelectedLocation(coordinates)
    clubForm.setValue("coordinates", coordinates)
    if (place) {
      clubForm.setValue("address", place, { shouldValidate: true })
    }
  }

  async function onUserSubmit(values: UserFormValues) {
    setIsLoading(true)

    try {
      await registerUser({
        ...values,
        role: "USER",
      })

      toast.success(`Registro exitoso. Bienvenido a TuCancha.`)
      router.push('/user/dashboard')
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Error al registrar. Por favor intenta nuevamente."
      toast.error(typeof msg === "object" ? JSON.stringify(msg) : msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function onClubSubmit(values: ClubFormValues) {
    setIsLoading(true)

    try {
      const clubPayload = {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        district: values.district?.trim() || undefined,
        description: values.description.trim(),
        services: selectedServices,
        coordinates: selectedLocation || values.coordinates || { lat: -12.046374, lng: -77.042793 },
        socialMedia: {
          facebook: values.facebookUrl?.trim() || undefined,
          instagram: values.instagramUrl?.trim() || undefined,
          twitter: values.twitterUrl?.trim() || undefined,
        },
      }

      await registerUser({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: "CLUB",
        club: clubPayload as any,
      })

      setShowClubWelcomeDialog(true)
    } catch (error: any) {
      console.error("Error en registro de club:", error)
      const msg = error?.response?.data?.message || "Error al registrar el club. Por favor verifica tus datos e intenta nuevamente."
      toast.error(typeof msg === "object" ? (Array.isArray(msg) ? msg.join(", ") : JSON.stringify(msg)) : msg)
    } finally {
      setIsLoading(false)
    }
  }

  const onClubError = (errors: any) => {
    console.warn("Errores de validación en formulario de club:", errors)
    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0]]?.message || "Por favor completa todos los campos obligatorios."
      toast.error(String(firstError))
    }
  }

  const onUserError = (errors: any) => {
    const errorKeys = Object.keys(errors)
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0]]?.message || "Por favor completa todos los campos obligatorios."
      toast.error(String(firstError))
    }
  }

  const handleGoogleSignUp = async () => {
    setShowGoogleLoading(true)
    try {
      const callbackUrl = searchParams.get("callbackUrl") || '/user/dashboard'
      await signIn("google", { callbackUrl })
      toast.success(`Bienvenido`)
    } catch (error) {
      toast.error("Error al iniciar sesión con Google")
    } finally {
      setShowGoogleLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "USER" | "CLUB")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="USER">Usuario</TabsTrigger>
          <TabsTrigger value="CLUB">Club Deportivo</TabsTrigger>
        </TabsList>

        {/* Formulario para Usuario */}
        <TabsContent value="USER">
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(onUserSubmit, onUserError)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre completo" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="correo@ejemplo.com"
                        type="email"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono *</FormLabel>
                    <FormControl>
                      <Input placeholder="Número de teléfono" disabled={isLoading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        autoCapitalize="none"
                        autoComplete="new-password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrarse como Usuario
              </Button>
            </form>
          </Form>
        </TabsContent>

        {/* Formulario para Club Deportivo */}
        <TabsContent value="CLUB">
          <Form {...clubForm}>
            <form onSubmit={clubForm.handleSubmit(onClubSubmit, onClubError)} className="space-y-6">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Información Básica</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={clubForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Club *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre del club deportivo" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="foundedYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Año de Fundación (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: 2020" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={clubForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del Club *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe tu club deportivo, instalaciones, deportes que ofrece, etc."
                          className="min-h-[100px] resize-none"
                          disabled={isLoading}
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
                <h3 className="text-lg font-medium">Información de Contacto y Cuenta</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={clubForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="club@ejemplo.com"
                            type="email"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoCorrect="off"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono / WhatsApp *</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de teléfono o WhatsApp" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={clubForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="•••••••• (mínimo 6 caracteres)"
                            type="password"
                            autoCapitalize="none"
                            autoComplete="new-password"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sitio Web (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tuclub.com.pe" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Ubicación */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Ubicación del Club</h3>

                {/* Selector de ubicación en mapa */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Buscar en Google Maps (opcional)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Escribe para buscar tu club y autocompletar la dirección y coordenadas exactas
                  </p>
                  <GooglePlacesAutocomplete
                    placeholder="Buscar dirección, distrito o lugar en el mapa..."
                    onPlaceSelect={handleLocationSelect}
                  />
                  {selectedLocation && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Coordenadas seleccionadas: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={clubForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección Física *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Av. Javier Prado Este 1234" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="district"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Distrito / Ciudad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: San Borja, Surco, Los Olivos..." disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Servicios y Horarios */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Servicios y Horarios</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium leading-none">
                      Servicios Disponibles
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">Selecciona los servicios que ofrece tu complejo</p>
                    <div className="grid grid-cols-2 gap-3 mt-3 sm:grid-cols-2">
                      {availableServices.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={service.id}
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                          />
                          <label
                            htmlFor={service.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {service.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <FormField
                  control={clubForm.control}
                  name="openingHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horarios de Atención (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lunes a Domingo 6:00 - 23:00" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Redes Sociales */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Redes Sociales (opcional)</h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={clubForm.control}
                    name="facebookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook</FormLabel>
                        <FormControl>
                          <Input placeholder="https://facebook.com/tuclub" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram</FormLabel>
                        <FormControl>
                          <Input placeholder="https://instagram.com/tuclub" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={clubForm.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter / X</FormLabel>
                        <FormControl>
                          <Input placeholder="https://twitter.com/tuclub" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full text-base py-6 font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Registrar Club Deportivo
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Las cuentas de club requieren aprobación del administrador antes de poder ser utilizadas.
              </p>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      <Dialog open={showClubWelcomeDialog} onOpenChange={(open) => {
        if (!open) {
          setShowClubWelcomeDialog(false);
          router.push("/login");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl text-primary font-bold">¡Registro de Club Deportivo Exitoso!</DialogTitle>
            <DialogDescription asChild>
              <div className="pt-2 text-foreground space-y-3">
                <p className="font-medium">
                  La creación de tu cuenta como club ha sido registrada y se encuentra <strong>esperando la confirmación del administrador</strong>.
                </p>
                <p>
                  Una vez que el administrador acepte tu club, accederás automáticamente a los <strong>30 días de prueba gratis</strong> de TuCancha para gestionar tus canchas y cobros.
                </p>
                <p className="text-muted-foreground text-sm">
                  Hemos enviado una notificación a tu correo electrónico con los detalles del registro.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button className="w-full" onClick={() => {
              setShowClubWelcomeDialog(false);
              router.push("/login");
            }}>
              Entendido, ir al Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

