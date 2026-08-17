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

// Distritos para el formulario de registro de clubes

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
  phone: z.string().min(8, {
    message: "Por favor ingresa un número de teléfono válido.",
  }),
  role: z.literal("USER"),
})

// Esquema extendido para club deportivo
const clubFormSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  email: z.string().email({
    message: "Por favor ingresa un correo electrónico válido.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
  role: z.literal("CLUB"),
  phone: z.string().min(8, {
    message: "Por favor ingresa un número de teléfono válido.",
  }),
  address: z.string().min(5, {
    message: "Por favor ingresa una dirección válida.",
  }),
  district: z.string({
    required_error: "Por favor selecciona un distrito.",
  }),
  description: z
    .string()
    .min(10, {
      message: "Por favor proporciona una descripción de al menos 10 caracteres.",
    })
    .max(500, {
      message: "La descripción no puede exceder los 500 caracteres.",
    }),
  website: z
    .string()
    .url({
      message: "Por favor ingresa una URL válida.",
    })
    .optional()
    .or(z.literal("")),
  foundedYear: z
    .string()
    .regex(/^\d{4}$/, {
      message: "Por favor ingresa un año válido (YYYY).",
    })
    .optional()
    .or(z.literal("")),
  openingHours: z.string().min(5, {
    message: "Por favor especifica los horarios de atención.",
  }),
  services: z.string().optional(),
  facebookUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
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
    clubForm.setValue("address", place)
  }

  async function onUserSubmit(values: UserFormValues) {
    setIsLoading(true)

    try {
      await registerUser({
        ...values,
        role: "USER",
      })

      toast.success(`Registro exitoso. Bienvenido a ${process.env.NEXT_PUBLIC_APP_NAME}.`)
      router.push('/user/bookings')
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Error al registrar. Por favor intenta nuevamente."
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function onClubSubmit(values: ClubFormValues) {
    setIsLoading(true)

    try {
      await registerUser({
        name: values.name,
        email:values.email,
        password: values.password,
        role: "CLUB",
        club: Object.assign(values, {services: selectedServices,
          coordinates: selectedLocation})
      })

      setShowClubWelcomeDialog(true)
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Error al registrar. Por favor intenta nuevamente."
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setShowGoogleLoading(true)
    try {
      const callbackUrl = searchParams.get("callbackUrl") || '/user/bookings'
      await signIn("google", { callbackUrl})
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
            <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
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
                    <FormLabel>Correo electrónico</FormLabel>
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
                        <FormLabel>Teléfono</FormLabel>
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
                    <FormLabel>Contraseña</FormLabel>
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
            <form onSubmit={clubForm.handleSubmit(onClubSubmit)} className="space-y-6">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Información Básica</h3>

                <div className="grid gap-4 sm:grid-cols-1">
                  <FormField
                    control={clubForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Club</FormLabel>
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
                          <Input placeholder="2020" disabled={isLoading} {...field} />
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
                      <FormLabel>Descripción del Club</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe tu club deportivo, historia, filosofía, etc."
                          className="min-h-[120px] resize-none"
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
                <h3 className="text-lg font-medium">Información de Contacto</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={clubForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
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
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="Número de teléfono" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={clubForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
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

              {/* Ubicación */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Ubicación</h3>

                {/* Selector de ubicación en mapa */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Ubicación en el Mapa
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Haz clic en el mapa para seleccionar la ubicación exacta de tu club
                  </p>
                  <GooglePlacesAutocomplete
                    placeholder="Buscar distrito, dirección o lugar..."
                    onPlaceSelect={handleLocationSelect}
                  />
                  {selectedLocation && (
                    <div className="text-sm text-muted-foreground">
                      Coordenadas seleccionadas: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              </div>

              {/* Servicios y Horarios */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Servicios y Horarios</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Servicios Disponibles
                    </label>
                    <p className="text-sm text-muted-foreground">Selecciona los servicios que ofrece tu club</p>
                    <div className="grid grid-cols-2 gap-4 mt-2 sm:grid-cols-2">
                      {availableServices.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={service.id}
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={(checked) => handleServiceChange(service.id, checked as boolean)}
                          />
                          <label
                            htmlFor={service.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
                      <FormLabel>Horarios de Atención</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Lunes a Domingo 6:00 - 22:00" disabled={isLoading} {...field} />
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
                        <FormLabel>Twitter</FormLabel>
                        <FormControl>
                          <Input placeholder="https://twitter.com/tuclub" disabled={isLoading} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Club Deportivo
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Las cuentas de club requieren aprobación del administrador antes de poder ser utilizadas.
              </p>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      {/* <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">O continuar con</span>
        </div>
      </div> */}

      {/* <Button variant="outline" type="button" onClick={handleGoogleSignUp} disabled={isLoading || showGoogleLoading}>
        {showGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            aria-hidden="true"
            focusable="false"
            data-prefix="fab"
            data-icon="google"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
        )}
        Registrarse con Google
      </Button> */}
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
                  La creación de tu cuenta como club ha sido registrada y requiere aprobación del administrador.
                </p>
                <p>
                  Además, has accedido a la <strong>prueba gratuita de 30 días</strong> de Tu Cancha.
                </p>
                <p className="text-muted-foreground text-sm">
                  Pasados los 30 días, se te notificará al correo de Gmail sobre el vencimiento y podrás renovar o cancelar la suscripción desde tu cuenta.
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
