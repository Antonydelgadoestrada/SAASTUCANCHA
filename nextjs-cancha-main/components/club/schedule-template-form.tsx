"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, PlusIcon, TrashIcon } from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  description: z.string().optional(),
  days: z.array(z.string()),
  slots: z
    .array(
      z.object({
        time: z.string(),
        status: z.enum(["available", "blocked"]),
      }),
    )
    .min(1, {
      message: "Debes agregar al menos un horario.",
    }),
})

type ScheduleTemplateFormProps = {
  onSubmit: (data: any) => void
  template?: any
}

export function ScheduleTemplateForm({ onSubmit, template }: ScheduleTemplateFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: template
      ? {
          name: template.name,
          description: template.description,
          days: template.days,
          slots: template.slots,
        }
      : {
          name: "",
          description: "",
          days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          slots: [
            { time: "07:00", status: "available" },
            { time: "07:30", status: "available" },
            { time: "08:00", status: "available" },
            { time: "08:30", status: "available" },
            { time: "09:00", status: "available" },
            { time: "09:30", status: "available" },
            { time: "10:00", status: "available" },
            { time: "10:30", status: "available" },
            { time: "11:00", status: "available" },
            { time: "11:30", status: "available" },
            { time: "12:00", status: "available" },
            { time: "12:30", status: "available" },
            { time: "13:00", status: "available" },
            { time: "13:30", status: "available" },
            { time: "14:00", status: "available" },
            { time: "14:30", status: "available" },
            { time: "15:00", status: "available" },
            { time: "15:30", status: "available" },
            { time: "16:00", status: "available" },
            { time: "16:30", status: "available" },
            { time: "17:00", status: "available" },
            { time: "17:30", status: "available" },
            { time: "18:00", status: "available" },
            { time: "18:30", status: "available" },
            { time: "19:00", status: "available" },
            { time: "19:30", status: "available" },
            { time: "20:00", status: "available" },
            { time: "20:30", status: "available" },
            { time: "21:00", status: "available" },
            { time: "21:30", status: "available" },
            { time: "22:00", status: "available" }
          ],
        },
  })

  useEffect(() => {
    if (!template?.id) return
    form.reset({
      name: template.name ?? "",
      description: template.description ?? "",
      days: Array.isArray(template.days) ? [...template.days] : [],
      slots: Array.isArray(template.slots) ? template.slots.map((s: any) => ({ ...s })) : [],
    })
  }, [template?.id, template])

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "slots",
  })

  // Generador rápido
  const [quickStart, setQuickStart] = useState("06:00")
  const [quickEnd, setQuickEnd] = useState("23:00")

  const generateSlots = () => {
    if (!quickStart || !quickEnd) return;
    const [startH, startM] = quickStart.split(":").map(Number);
    const [endH, endM] = quickEnd.split(":").map(Number);
    
    let currentH = startH;
    let currentM = startM;
    const endMinutes = endH * 60 + endM;
    const interval = 30; // Obligatorio de 30 en 30 para no romper lógica de negocio

    const newSlots = [];

    while ((currentH * 60 + currentM) <= endMinutes) {
      const h = currentH.toString().padStart(2, "0");
      const m = currentM.toString().padStart(2, "0");
      newSlots.push({ time: `${h}:${m}`, status: "available" as const });

      currentM += interval;
      if (currentM >= 60) {
        currentH += Math.floor(currentM / 60);
        currentM = currentM % 60;
      }
    }
    
    // Al menos un slot si fallan los cálculos
    if (newSlots.length === 0) {
      newSlots.push({ time: quickStart, status: "available" as const });
    }

    form.setValue("slots", newSlots, { shouldDirty: true });
  }
  async function handleSubmit(values: z.infer<typeof formSchema>) {
      setIsLoading(true)
      // Simular retraso de red
      const dataToSubmit = {
        ...values,
        ...(template && {
          id: template.id,
          venueId: template.venueId,
        }),
      }
      await onSubmit(dataToSubmit)
   
      setIsLoading(false)
  }

  const daysOfWeek = [
    { id: "monday", label: "Lunes" },
    { id: "tuesday", label: "Martes" },
    { id: "wednesday", label: "Miércoles" },
    { id: "thursday", label: "Jueves" },
    { id: "friday", label: "Viernes" },
    { id: "saturday", label: "Sábado" },
    { id: "sunday", label: "Domingo" },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} 
      className="space-y-6"
      >
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-1">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de la plantilla</FormLabel>
                <FormControl>
                  <Input placeholder="Horario estándar" {...field} />
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
                <Input placeholder="Descripción de la plantilla de horarios" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="days"
          render={() => (
            <FormItem>
              <div className="mb-4">
                <FormLabel>Días de la semana</FormLabel>
                <FormDescription>Selecciona los días a los que se aplicará esta plantilla.</FormDescription>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {daysOfWeek.map((day) => (
                  <FormField
                    key={day.id}
                    control={form.control}
                    name="days"
                    render={({ field }) => {
                      return (
                        <FormItem key={day.id} className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(day.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, day.id])
                                  : field.onChange(field.value?.filter((value) => value !== day.id))
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{day.label}</FormLabel>
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

        <div>
          {/* Generador rápido */}
          <div className="rounded-md border p-4 bg-muted/20 mb-6">
            <FormLabel className="text-base font-semibold mb-3 block">Generador Rápido de Horarios</FormLabel>
            <FormDescription className="mb-4 text-xs">Ahorra tiempo generando todos los horarios de forma automática según la apertura y cierre de tu club.</FormDescription>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Apertura</label>
                <Input type="time" value={quickStart} onChange={e => setQuickStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Cierre</label>
                <Input type="time" value={quickEnd} onChange={e => setQuickEnd(e.target.value)} />
              </div>
            </div>
            <Button type="button" variant="secondary" className="w-full text-sm font-semibold" onClick={generateSlots}>
              Autocompletar Lista Abajo
            </Button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <FormLabel>Horarios Manuales</FormLabel>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ time: "", status: "available" })}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Agregar Fila
            </Button>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name={`slots.${index}.time`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="HH:MM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`slots.${index}.status`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="available">Disponible</SelectItem>
                          <SelectItem value="blocked">Bloqueado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="flex-shrink-0"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="sr-only">Eliminar horario</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {template ? "Actualizar Plantilla" : "Aplicar Plantilla"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
