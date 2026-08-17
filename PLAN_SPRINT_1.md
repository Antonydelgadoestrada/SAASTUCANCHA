# Sprint 1: Diagnóstico y Corrección de Gestión de Horarios

## Objetivo General
Que los administradores puedan modificar y guardar horarios correctamente, con cambios reflejados automáticamente en el calendario.

---

## Tarea 1: Corrección del Backend - findAllByClub

### Problema
El método `findAllByClub` actualmente devuelve solo una plantilla con `findOne()` en lugar de todas las plantillas del club.

### Cambios Requeridos
**Archivo:** `backend-tucancha-main/src/schedule/schedule-template.service.ts`

```typescript
// Línea 300-307 - CAMBIAR:
async findAllByClub(clubId: string) {
  return this.templateRepo.findOne({
    where: {
      club: { id: clubId },
    },
    order: { createdAt: 'DESC' },
  })
}

// POR:
async findAllByClub(clubId: string) {
  return this.templateRepo.find({
    where: {
      club: { id: clubId },
    },
    order: { createdAt: 'DESC' },
  })
}
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Navegar a: `/club/schedules`
3. Al cargar la página, verificar que se carguen todas las plantillas del club
4. En DevTools -> Network, verificar la llamada a `/schedule-templates` retorne múltiples plantillas

---

## Tarea 2: Activar Aplicación Automática de Plantillas

### Problema
Cuando se crea una plantilla, no se aplica automáticamente a las canchas.

### Cambios Requeridos
**Archivo:** `backend-tucancha-main/src/schedule/schedule-template.service.ts`

```typescript
// Línea 44 - DESCOMENTAR:
async create(dto: CreateScheduleTemplateDto) {
  const newTemplate = this.templateRepo.create({...dto, club:{id:dto.clubId}})
  const savedTemplate = await this.templateRepo.save(newTemplate);
  // await this.applyTemplateToCourts(savedTemplate) // Quitar comentario
  await this.applyTemplateToCourts(savedTemplate) // Activar
  return savedTemplate
}
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Ir a `/club/schedules`
3. Click en "Aplicar Plantilla" -> Crear nueva plantilla
4. Completar formulario y guardar
5. Verificar que los horarios se apliquen automáticamente al calendario
6. En backend, revisar logs para confirmar que se ejecutó `applyTemplateToCourts`

---

## Tarea 3: Implementar Estado Centralizado en Frontend

### Problema
Los cambios en horarios no se acumulan ni persisten.

### Cambios Requeridos
**Archivo:** `nextjs-cancha-main/components/club/schedule-management.tsx`

```typescript
// Agregar después de los useState existentes:
const [scheduleChanges, setScheduleChanges] = useState<{[key: string]: any}>({})

// Reemplazar handleSaveSchedule (líneas 83-85):
const handleSaveSchedule = async () => {
  try {
    const changesArray = Object.values(scheduleChanges)
    if (changesArray.length > 0) {
      await bulkUpdate(changesArray)
      setScheduleChanges({})
      toast.success("Horarios guardados correctamente")
      // Recargar datos
      refetch()
    } else {
      toast.info("No hay cambios para guardar")
    }
  } catch (error) {
    toast.error("Error al guardar horarios")
    console.error(error)
  }
}

// Agregar función para manejar cambios individuales:
const handleSlotChange = (status: string, time: string, date: Date) => {
  const changeKey = `${format(date, 'yyyy-MM-dd')}-${time}-${selectedCourt}`
  setScheduleChanges(prev => ({
    ...prev,
    [changeKey]: {
      courtId: selectedCourt,
      date: format(date, 'yyyy-MM-dd'),
      time,
      status
    }
  }))
}
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Ir a `/club/schedules`
3. Cambiar el estado de varios horarios (click en slots)
4. Click en "Guardar Cambios"
5. Verificar que aparezca el toast de éxito
6. Recargar la página y confirmar que los cambios persistieron

---

## Tarea 4: Conectar ScheduleTimeSlot con Estado Centralizado

### Problema
Los cambios en los slots no se comunican con el componente padre.

### Cambios Requeridos
**Archivo:** `nextjs-cancha-main/components/club/schedule-time-slot.tsx`

```typescript
// Modificar handleStatusChange (línea 59):
const handleStatusChange = (newStatus: "available" | "occupied" | "blocked") => {
  setCurrentStatus(newStatus)
  setIsDialogOpen(false)
  onStatusChange?.(newStatus, time, date); // Asegurar que se llame
  toast.success(`Horario marcado como ${statusLabels[newStatus].toLowerCase()}`)
}

// En schedule-management.tsx, actualizar el componente ScheduleTimeSlot:
<ScheduleTimeSlot
  key={i}
  status={/* obtener estado real de datos */}
  time={`${hour}:00`}
  date={day}
  onStatusChange={handleSlotChange} // Agregar esta prop
/>
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Ir a `/club/schedules`
3. Click en cualquier slot de horario
4. Cambiar su estado en el diálogo
5. Verificar que el color del slot cambie inmediatamente
6. Click en "Guardar Cambios" y confirmar persistencia

---

## Tarea 5: Cargar Datos Reales en lugar de Datos Aleatorios

### Problema
El calendario muestra datos aleatorios en lugar de horarios reales de la base de datos.

### Cambios Requeridos
**Archivo:** `nextjs-cancha-main/components/club/schedule-management.tsx`

```typescript
// Agregar imports al inicio:
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getByCourt } from "@/lib/schedule"

// Agregar hook para cargar datos:
const { data: courtSchedule, refetch } = useQuery({
  queryKey: ['court-schedule', selectedCourt, weekStart],
  queryFn: () => getByCourt(
    format(weekStart, 'yyyy-MM-dd'),
    format(addDays(weekStart, 6), 'yyyy-MM-dd'),
    selectedCourt === "all" ? courts[0]?.id : selectedCourt
  ),
  enabled: selectedCourt !== "all" && courts.length > 0
})

// Reemplazar generación aleatoria (líneas 201-213):
{Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
  <div key={hour} className="grid grid-cols-8 gap-2 border-b py-1">
    <div className="flex items-center px-2 text-sm">{hour}:00</div>
    {weekDays.map((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const timeStr = `${hour}:00`
      const slot = courtSchedule?.find(s => 
        s.date === dateStr && s.time === timeStr
      )
      return (
        <ScheduleTimeSlot
          key={i}
          status={slot?.status || 'available'}
          time={timeStr}
          date={day}
          onStatusChange={handleSlotChange}
        />
      )
    })}
  </div>
))}
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Ir a `/club/schedules`
3. Seleccionar una cancha específica (no "Todas las canchas")
4. Verificar que los horarios mostrados coincidan con los de la base de datos
5. Cambiar algunos horarios y guardar
6. Recargar y confirmar que los datos son consistentes

---

## Tarea 6: Mejorar Manejo de Errores y Logging

### Problema
Falta visibilidad sobre qué falla cuando los cambios no se guardan.

### Cambios Requeridos
**Archivo:** `backend-tucancha-main/src/schedule/schedule-template.service.ts`

```typescript
// Mejorar bulkUpdate (líneas 48-91):
async bulkUpdate(slots: Partial<CourtScheduleAvailability>[]) {
  console.log(`[BulkUpdate] Iniciando actualización de ${slots.length} slots`)
  
  const updatePromises = slots.map(async (slot, index) => {
    try {
      let { id, status } = slot;
  
      if (id) {
        await this.availabilityRepo.update(id, { status: status as SlotStatus });
        console.log(`[BulkUpdate] Slot ${id} actualizado a ${status}`)
      } else {
        const existing = await this.availabilityRepo.findOne({
          where: {
            court: { id: slot.courtId },
            date: slot.date,
            time: slot.time,
            template: { id: slot.templateId },
          },
          relations: ['court', 'template'],
        });
  
        if (existing) {
          await this.availabilityRepo.update(existing.id, { status: slot.status });
          console.log(`[BulkUpdate] Slot existente actualizado: ${existing.id}`)
        } else {
          const newSlot = this.availabilityRepo.create({
            court: { id: slot.courtId },
            date: slot.date,
            time: slot.time,
            status: slot.status,
            template: { id: slot.templateId },
          });
          const saved = await this.availabilityRepo.save(newSlot);
          console.log(`[BulkUpdate] Nuevo slot creado: ${saved.id}`)
        }
      }
  
      return { success: true, index }
    } catch (error) {
      console.error(`[BulkUpdate] Error en slot ${index}:`, error)
      return { success: false, index, error }
    }
  });
  
  const results = await Promise.all(updatePromises)
  const failed = results.filter(r => !r.success)
  
  if (failed.length > 0) {
    throw new Error(`Fallaron ${failed.length} de ${slots.length} actualizaciones`)
  }
  
  console.log(`[BulkUpdate] Completado exitosamente: ${slots.length} slots`)
  return results
}
```

### Prueba
1. Iniciar sesión como **Administrador**
2. Ir a `/club/schedules`
3. Realizar cambios múltiples y guardar
4. En la consola del backend, verificar los logs de bulkUpdate
5. Provocar un error (ej: datos inválidos) y verificar el manejo de errores

---

## Plan de Testing General

### Acceso a la Aplicación
1. **URL:** `http://localhost:3000` (Frontend) y `http://localhost:3001` (Backend)
2. **Rol:** Administrador (necesitarás credenciales de admin)
3. **Navegación:** `/club/schedules`

### Casos de Test

#### Test 1: Creación y Aplicación de Plantillas
- **Pasos:**
  1. Login como administrador
  2. Ir a Gestión de Horarios
  3. Click "Aplicar Plantilla" → Crear nueva
  4. Llenar formulario con horarios de 6AM a 11PM
  5. Guardar plantilla
- **Resultado Esperado:** Plantilla se crea y aplica automáticamente

#### Test 2: Modificación Individual de Horarios
- **Pasos:**
  1. Seleccionar una cancha específica
  2. Click en varios slots para cambiar su estado
  3. Click "Guardar Cambios"
  4. Recargar página
- **Resultado Esperado:** Los cambios persisten

#### Test 3: Sincronización con Calendario
- **Pasos:**
  1. Aplicar una plantilla nueva
  2. Navegar a diferentes semanas
  3. Verificar que los horarios sean consistentes
- **Resultado Esperado:** Calendario refleja cambios en tiempo real

#### Test 4: Manejo de Errores
- **Pasos:**
  1. Desconectar backend
  2. Intentar guardar cambios
  3. Observar mensaje de error
- **Resultado Esperado:** Mensaje claro de error sin crash

### Herramientas de Debugging
- **Frontend:** DevTools → Network (ver llamadas API)
- **Backend:** Consola (ver logs de bulkUpdate)
- **Base de Datos:** Verificar tabla `court_schedule_availability`

---

## Criterios de Aceptación

✅ **CRUD de horarios funcional**
- Crear plantillas: OK
- Leer horarios: OK  
- Actualizar horarios: OK
- Eliminar horarios: OK

✅ **Posibilidad de crear/modificar rangos completos**
- Plantillas con múltiples horarios: OK
- Aplicación a rangos de fechas: OK

✅ **Cambios reflejados automáticamente en calendario**
- Persistencia en BD: OK
- Actualización en UI: OK
- Sincronización entre vistas: OK

---

## Tiempo Estimado: 1-2 Semanas

- **Semana 1:** Tareas 1-3 (Backend y estado básico)
- **Semana 2:** Tareas 4-6 (Integración completa y testing)
