"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarIcon, ClockIcon, CopyIcon, EditIcon, PlusIcon, SaveIcon, TrashIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Datos de ejemplo
const courts = [
  {
    id: 1,
    name: "Cancha de Fútbol 5",
    venue: "Sede Principal",
    sport: "Fútbol",
    basePrice: 35,
    morningPrice: 30,
    eveningPrice: 40,
    weekendPrice: 45,
    hasPromotion: true,
    promotionPrice: 25,
    promotionDays: ["monday", "tuesday", "wednesday"],
    promotionHours: ["10:00", "11:00", "12:00", "13:00"],
  },
  {
    id: 2,
    name: "Cancha de Fútbol 7",
    venue: "Sede Principal",
    sport: "Fútbol",
    basePrice: 45,
    morningPrice: 40,
    eveningPrice: 50,
    weekendPrice: 55,
    hasPromotion: false,
    promotionPrice: null,
    promotionDays: [],
    promotionHours: [],
  },
  {
    id: 3,
    name: "Cancha de Tenis #1",
    venue: "Sede Secundaria",
    sport: "Tenis",
    basePrice: 25,
    morningPrice: 20,
    eveningPrice: 30,
    weekendPrice: 35,
    hasPromotion: true,
    promotionPrice: 15,
    promotionDays: ["monday", "wednesday", "friday"],
    promotionHours: ["14:00", "15:00", "16:00"],
  },
  {
    id: 4,
    name: "Cancha de Pádel #1",
    venue: "Sede Principal",
    sport: "Pádel",
    basePrice: 20,
    morningPrice: 15,
    eveningPrice: 25,
    weekendPrice: 30,
    hasPromotion: false,
    promotionPrice: null,
    promotionDays: [],
    promotionHours: [],
  },
]

const formSchema = z.object({
  courtId: z.string(),
  basePrice: z.coerce.number().min(0, "El precio base no puede ser negativo"),
  morningPrice: z.coerce.number().min(0, "El precio matutino no puede ser negativo"),
  eveningPrice: z.coerce.number().min(0, "El precio nocturno no puede ser negativo"),
  weekendPrice: z.coerce.number().min(0, "El precio de fin de semana no puede ser negativo"),
  hasPromotion: z.boolean().default(false),
  promotionPrice: z.coerce.number().min(0, "El precio promocional no puede ser negativo").optional().nullable(),
  promotionDays: z.array(z.string()).optional(),
  promotionHours: z.array(z.string()).optional(),
})

export function ClubPricingContent() {
  const [activeTab, setActiveTab] = useState("standard")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedCourt, setSelectedCourt] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [courtsList, setCourtsList] = useState(courts)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      courtId: "",
      basePrice: 0,
      morningPrice: 0,
      eveningPrice: 0,
      weekendPrice: 0,
      hasPromotion: false,
      promotionPrice: null,
      promotionDays: [],
      promotionHours: [],
    },
  })

  const handleEditPricing = (court: any) => {
    setSelectedCourt(court)
    form.reset({
      courtId: court.id.toString(),
      basePrice: court.basePrice,
      morningPrice: court.morningPrice,
      eveningPrice: court.eveningPrice,
      weekendPrice: court.weekendPrice,
      hasPromotion: court.hasPromotion,
      promotionPrice: court.promotionPrice,
      promotionDays: court.promotionDays,
      promotionHours: court.promotionHours,
    })
    setIsDialogOpen(true)
  }

  const handleDuplicatePricing = (court: any) => {
    toast.success(`Configuración de precios de "${court.name}" duplicada`)
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true)

    try {
      // Simular retraso de red
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Actualizar la lista de canchas con los nuevos precios
      const updatedCourts = courtsList.map((court) => {
        if (court.id.toString() === values.courtId) {
          return {
            ...court,
            basePrice: values.basePrice,
            morningPrice: values.morningPrice,
            eveningPrice: values.eveningPrice,
            weekendPrice: values.weekendPrice,
            hasPromotion: values.hasPromotion,
            promotionPrice: values.hasPromotion ? values.promotionPrice : null,
            promotionDays: values.hasPromotion ? values.promotionDays || [] : [],
            promotionHours: values.hasPromotion ? values.promotionHours || [] : [],
          }
        }
        return court
      })

      setCourtsList(updatedCourts)
      toast.success("Precios actualizados correctamente")
      setIsDialogOpen(false)
    } catch (error) {
      toast.error("Error al actualizar los precios")
    } finally {
      setIsLoading(false)
    }
  }

  const daysOfWeek = [
    { value: "monday", label: "Lunes" },
    { value: "tuesday", label: "Martes" },
    { value: "wednesday", label: "Miércoles" },
    { value: "thursday", label: "Jueves" },
    { value: "friday", label: "Viernes" },
    { value: "saturday", label: "Sábado" },
    { value: "sunday", label: "Domingo" },
  ]

  const hoursOfDay = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8 // Empezar desde las 8:00
    return { value: `${hour}:00`, label: `${hour}:00` }
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Gestión de Precios</h2>
        <p className="text-muted-foreground">Configura los precios de tus canchas deportivas.</p>
      </div>

      <Tabs defaultValue="standard" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Precios Estándar
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4" />
            Promociones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courtsList.map((court) => (
              <Card key={court.id}>
                <CardHeader>
                  <CardTitle>{court.name}</CardTitle>
                  <CardDescription>
                    {court.venue} - {court.sport}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio base</span>
                      <span className="font-medium">${court.basePrice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio matutino (8:00 - 14:00)</span>
                      <span className="font-medium">${court.morningPrice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio nocturno (18:00 - 22:00)</span>
                      <span className="font-medium">${court.eveningPrice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Precio fin de semana</span>
                      <span className="font-medium">${court.weekendPrice}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => handleDuplicatePricing(court)}>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Duplicar
                  </Button>
                  <Button size="sm" onClick={() => handleEditPricing(court)}>
                    <EditIcon className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="promotions" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courtsList
              .filter((court) => court.hasPromotion)
              .map((court) => (
                <Card key={court.id}>
                  <CardHeader>
                    <CardTitle>{court.name}</CardTitle>
                    <CardDescription>
                      {court.venue} - {court.sport}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Precio promocional</span>
                        <span className="font-medium">${court.promotionPrice}</span>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Días de promoción</h4>
                        <div className="flex flex-wrap gap-1">
                          {court.promotionDays.map((day) => (
                            <span
                              key={day}
                              className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                            >
                              {daysOfWeek.find((d) => d.value === day)?.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Horas de promoción</h4>
                        <div className="flex flex-wrap gap-1">
                          {court.promotionHours.map((hour) => (
                            <span
                              key={hour}
                              className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                            >
                              {hour}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => handleEditPricing(court)}>
                      <EditIcon className="mr-2 h-4 w-4" />
                      Editar Promoción
                    </Button>
                  </CardFooter>
                </Card>
              ))}

            {courtsList
              .filter((court) => !court.hasPromotion)
              .map((court) => (
                <Card key={court.id} className="border-dashed">
                  <CardHeader>
                    <CardTitle>{court.name}</CardTitle>
                    <CardDescription>
                      {court.venue} - {court.sport}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <PlusIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-lg font-medium">Sin promoción</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Esta cancha no tiene promociones configuradas.</p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => handleEditPricing(court)}>
                      Configurar Promoción
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo de edición de precios */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configuración de Precios</DialogTitle>
            <DialogDescription>
              {selectedCourt && `Configura los precios para ${selectedCourt.name}.`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard">Precios Estándar</TabsTrigger>
                  <TabsTrigger value="promotions">Promociones</TabsTrigger>
                </TabsList>
                <TabsContent value="standard" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Base</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>Precio estándar para la cancha.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="morningPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Matutino (8:00 - 14:00)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>Precio para horarios de mañana.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="eveningPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Nocturno (18:00 - 22:00)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>Precio para horarios nocturnos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weekendPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Fin de Semana</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" {...field} />
                        </FormControl>
                        <FormDescription>Precio para sábados y domingos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value="promotions" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="hasPromotion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Activar Promoción</FormLabel>
                          <FormDescription>Habilita precios promocionales para esta cancha.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch("hasPromotion") && (
                    <>
                      <FormField
                        control={form.control}
                        name="promotionPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio Promocional</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormDescription>Precio especial para los horarios promocionales.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="promotionDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Días de Promoción</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={(value) => {
                                  const currentValues = field.value || []
                                  if (currentValues.includes(value)) {
                                    field.onChange(currentValues.filter((day) => day !== value))
                                  } else {
                                    field.onChange([...currentValues, value])
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona los días" />
                                </SelectTrigger>
                                <SelectContent>
                                  {daysOfWeek.map((day) => (
                                    <SelectItem
                                      key={day.value}
                                      value={day.value}
                                      className={field.value?.includes(day.value) ? "bg-primary/10 font-medium" : ""}
                                    >
                                      {day.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {field.value?.map((day) => (
                                <span
                                  key={day}
                                  className="flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                                >
                                  {daysOfWeek.find((d) => d.value === day)?.label}
                                  <button
                                    type="button"
                                    className="ml-1 rounded-full p-1 hover:bg-primary/20"
                                    onClick={() => {
                                      field.onChange(field.value?.filter((d) => d !== day))
                                    }}
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <FormDescription>Días en los que se aplicará la promoción.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="promotionHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horas de Promoción</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={(value) => {
                                  const currentValues = field.value || []
                                  if (currentValues.includes(value)) {
                                    field.onChange(currentValues.filter((hour) => hour !== value))
                                  } else {
                                    field.onChange([...currentValues, value])
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona las horas" />
                                </SelectTrigger>
                                <SelectContent>
                                  {hoursOfDay.map((hour) => (
                                    <SelectItem
                                      key={hour.value}
                                      value={hour.value}
                                      className={field.value?.includes(hour.value) ? "bg-primary/10 font-medium" : ""}
                                    >
                                      {hour.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {field.value?.map((hour) => (
                                <span
                                  key={hour}
                                  className="flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                                >
                                  {hour}
                                  <button
                                    type="button"
                                    className="ml-1 rounded-full p-1 hover:bg-primary/20"
                                    onClick={() => {
                                      field.onChange(field.value?.filter((h) => h !== hour))
                                    }}
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <FormDescription>Horas en las que se aplicará la promoción.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <ClockIcon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <SaveIcon className="mr-2 h-4 w-4" />
                  )}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
