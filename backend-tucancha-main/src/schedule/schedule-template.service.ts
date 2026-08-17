import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository, DataSource } from 'typeorm'
import { CourtService } from '../court/court.service'
import { CourtScheduleAvailability } from './court_schedule_availability.entity'
import { ScheduleTemplate } from './schedule_template.entity'
import { CreateScheduleTemplateDto } from './dto/create-schedule-template.dto'
export enum SlotStatus {
  AVAILABLE = 'available',
  BLOCKED = 'blocked',
  OCCUPIED = 'occupied',
  ON_HOLD = 'on-hold',
}
// Antes se materializaban 14 días de slots en DB. Ahora esta tabla se usa como
// "overrides" (solo cambios), así que no pre-generamos calendario.
const daysToAvaleable = 0;

@Injectable()
export class ScheduleTemplateService {
  constructor(
    @InjectRepository(ScheduleTemplate)
    private readonly templateRepo: Repository<ScheduleTemplate>,

    @InjectRepository(CourtScheduleAvailability)
    private readonly availabilityRepo: Repository<CourtScheduleAvailability>,

    private readonly courtsService: CourtService, // este servicio debe tener un método `findAllByVenue`
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Plantilla usada para pintar el calendario + si está enlazada a la cancha (`schedule_template_id`).
   * Los eventos solo deben gestionarse cuando `linkedTemplateId` no es null.
   */
  async getTemplateByCourtId(courtId: string): Promise<{
    template: ScheduleTemplate | null
    linkedTemplateId: string | null
  }> {
    const court: any = await this.courtsService.findOne(courtId, ['venue', 'venue.club'])
    if (!court) {
      return { template: null, linkedTemplateId: null }
    }

    const linkedId: string | null = court.schedule_template_id ?? null
    if (linkedId) {
      const template = await this.templateRepo.findOne({ where: { id: linkedId } })
      return { template: template ?? null, linkedTemplateId: linkedId }
    }

    const clubId = court?.venue?.club?.id
    if (!clubId) {
      return { template: null, linkedTemplateId: null }
    }

    const fallback = await this.templateRepo
      .createQueryBuilder('t')
      .innerJoin('t.club', 'club', 'club.id = :clubId', { clubId })
      .orderBy('t.createdAt', 'ASC')
      .select(['t.id', 't.name', 't.description', 't.venueId', 't.days', 't.slots', 't.createdAt', 't.updatedAt'])
      .getOne()

    return { template: fallback ?? null, linkedTemplateId: null }
  }

  async findOne(id: string) {
    return await this.templateRepo.findOneByOrFail({ id })
  }

  /** Para comprobar pertenencia al club antes de actualizar. */
  async findOneWithClub(id: string) {
    return this.templateRepo.findOne({ where: { id }, relations: ['club'] })
  }
  async update(id: string, data: Partial<ScheduleTemplate>) {
    const allowed = ['name', 'description', 'days', 'slots', 'venueId'] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in data && (data as Record<string, unknown>)[key] !== undefined) {
        patch[key] = (data as Record<string, unknown>)[key];
      }
    }
    if (Object.keys(patch).length === 0) {
      return this.findOne(id);
    }
    await this.templateRepo.update(id, patch as Partial<ScheduleTemplate>);
    return this.findOne(id);
  }
  
  async create(dto: CreateScheduleTemplateDto) {
    const newTemplate = this.templateRepo.create({...dto, club:{id:dto.clubId}})
    const savedTemplate = await this.templateRepo.save(newTemplate);
    // Ya no materializamos slots al crear plantilla.
    return savedTemplate
  }

  async bulkUpdate(slots: Partial<CourtScheduleAvailability>[], clubId?: string) {
    console.log(`[BulkUpdate] Iniciando actualización de ${slots.length} slots`)

    if (!slots || slots.length === 0) {
      return []
    }

    // Si se proporciona clubId, validar acceso a todas las canchas involucradas
    if (clubId) {
      const courtIds = Array.from(new Set(slots.map(s => s.courtId).filter(Boolean)))
      for (const courtId of courtIds) {
        const court: any = await this.courtsService.findOne(courtId as string, ['venue', 'venue.club'])
        if (!court || court?.venue?.club?.id !== clubId) {
          throw new ForbiddenException(`No tienes permisos sobre la cancha ID ${courtId}`)
        }
      }
    }

    return await this.availabilityRepo.manager.transaction(async transactionalEntityManager => {
      const results = []
      for (let index = 0; index < slots.length; index++) {
        const slot = slots[index]
        const { id, status, courtId, date, time, templateId } = slot

        if (id) {
          await transactionalEntityManager.update(CourtScheduleAvailability, id, { status: status as SlotStatus })
          console.log(`[BulkUpdate] Slot ${id} actualizado a ${status}`)
        } else {
          const existing = await transactionalEntityManager.findOne(CourtScheduleAvailability, {
            where: { courtId, date, time },
          })

          if (existing) {
            await transactionalEntityManager.update(CourtScheduleAvailability, existing.id, { status: slot.status as SlotStatus })
            console.log(`[BulkUpdate] Slot existente actualizado: ${existing.id}`)
          } else {
            const newSlot = transactionalEntityManager.create(CourtScheduleAvailability, {
              court: courtId ? ({ id: courtId } as any) : undefined,
              courtId,
              date,
              time,
              status: status as SlotStatus,
              template: templateId ? ({ id: templateId } as any) : undefined,
              templateId,
            })
            const saved = await transactionalEntityManager.save(CourtScheduleAvailability, newSlot)
            console.log(`[BulkUpdate] Nuevo slot creado: ${saved.id}`)
          }
        }
        results.push({ success: true, index })
      }
      console.log(`[BulkUpdate] Transacción completada exitosamente: ${slots.length} slots`)
      return results
    })
  }
  
  

  async findOneByQuery(query:Object){
    return await this.templateRepo.findOne(query);
  }

  async findByQuery(query:Object){
    return await this.availabilityRepo.find(query);
  }
  
  async applyTemplateCron(){
    // Ya no materializamos slots en cron.
    return 0;
  }
  async applyTemplateToCourts(template: any): Promise<number> {
    // Deshabilitado: ya no se crean slots masivos.
    return 0;
    const courts = await this.courtsService.findAllByVenueByClub(
      template.club.id,
      template.venueId,
    );
    if(courts.length == 0) return 0
    const today = new Date();
    const futureDates = Array.from({ length: daysToAvaleable }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      return d;
    });
  
    const daysMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
  
    const selectedDays = template.days.map((d) => daysMap[d.toLowerCase()]);
    const toSave: any[] = [];
  
    for (const court of courts) {
      for (const date of futureDates) {
        if (!selectedDays.includes(date.getDay())) continue;
  
        const dateStr = date.toISOString().split('T')[0];
  
        const existingAvailabilities = await this.availabilityRepo.find({
          where: {
            courtId: court.id,
            date: dateStr,
          },
        });
  
        for (const slot of template.slots) {
          const existing = existingAvailabilities.find(
            (a) => a.time === slot.time,
          );
  
          if (!existing) {
            // No existe, crear nuevo
            toSave.push(
              this.availabilityRepo.create({
                court,
                date: dateStr,
                time: slot.time,
                status: slot.status,
                template,
              }),
            );
          } else if (
            existing.status === 'available' ||
            existing.status === 'blocked'
          ) {
            // Actualizar estado y templateId
            existing.status = slot.status;
            existing.template = template;
            existing.templateId = template.id;
            toSave.push(existing);
          }
          // Si es 'occupied' o 'on-hold', no se modifica
        }
      }
    }
  
    if (toSave.length) {
      await this.availabilityRepo.save(toSave);
    }
  
    return toSave.length;
  }

  async applyTemplateToCourtSafe(template: any, court: any) {
    // Deshabilitado: ya no se crean slots masivos.
    return { message: 'applyTemplateToCourtSafe deshabilitado (overrides only)' };
    const today = new Date();
    const futureDates = Array.from({ length: daysToAvaleable }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() + i);
      return d;
    });
  
    const daysMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
  
    const selectedDays = template.days.map((d) => daysMap[d.toLowerCase()]);
    const availabilitiesToSave = [];
  
    for (const date of futureDates) {
      if (!selectedDays.includes(date.getDay())) continue;
  
      const dateStr = date.toISOString().split('T')[0];
  
      // Obtener todos los slots ya existentes de esa cancha y esa fecha
      const existingSlots = await this.availabilityRepo.find({
        where: {
          courtId: court.id,
          date: dateStr,
        },
      });
  
      for (const slot of template.slots) {
        const existing = existingSlots.find((s) => s.time === slot.time);
  
        if (existing) {
          if (existing.status === 'occupied' || existing.status === 'on-hold') {
            // No modificar si está ocupado
            continue;
          } else {
            // Actualizar si está en available o blocked (puedes elegir si actualizas el template o status)
            existing.status = slot.status;
            existing.templateId = template.id;
            availabilitiesToSave.push(existing);
          }
        } else {
          // Crear nuevo si no existe
          availabilitiesToSave.push(
            this.availabilityRepo.create({
              court,
              date: dateStr,
              time: slot.time,
              status: slot.status,
              template,
            }),
          );
        }
      }
    }
  
    await this.availabilityRepo.save(availabilitiesToSave);
  
    return {
      message: `Plantilla aplicada a la cancha ${court.name} sin sobrescribir ocupados.`,
    };
  }
  
  

  async getAvailabilityByVenueAndDates(venueId: string, start: string, end: string) {
    const availabilities = await this.availabilityRepo.find({
      where: {
        date: Between(start, end),
        court: {
          venue: {
            id: +venueId,
          },
        },
      },
      relations: ['court', 'court.venue'],
    })
  
    return availabilities.map((a) => ({
      courtId: a.court.id,
      date: a.date,
      time: a.time,
      status: a.status,
    }))
  }

  async getAvailabilityByCourtAndDates(courtId: string, start: string, end: string) {
    const overrides = await this.availabilityRepo.find({
      where: {
        courtId,
        date: Between(start, end),
      },
      order: {
        date: 'ASC',
        time: 'ASC',
      },
    });

    const court = await this.dataSource.getRepository('Court').findOne({
      where: { id: courtId },
    });

    if (!court || !court.schedule_template_id) {
      return overrides;
    }

    const template = await this.dataSource.getRepository('ScheduleTemplate').findOne({
      where: { id: court.schedule_template_id },
    });

    if (!template) {
      return overrides;
    }

    // Generar slots virtuales basados en la plantilla
    const startOffset = new Date(start + 'T00:00:00');
    const endOffset = new Date(end + 'T00:00:00');
    const daysMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const enabledDays = template.days.map((d: string) => daysMap[d.toLowerCase()]);

    const virtualSlots: any[] = [];
    const currentDate = new Date(startOffset);

    while (currentDate <= endOffset) {
      const dayOfWeek = currentDate.getDay();
      if (enabledDays.includes(dayOfWeek)) {
        const dateStr = currentDate.toISOString().split('T')[0];

        for (const slot of template.slots) {
          // Buscar si hay override
          const override = overrides.find((o) => o.date === dateStr && o.time === slot.time);
          if (override) {
            virtualSlots.push(override);
          } else {
            virtualSlots.push({
              courtId,
              date: dateStr,
              time: slot.time,
              status: slot.status,
            });
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Agregar overrides que estén fuera de los días habilitados de la plantilla
    for (const override of overrides) {
      const alreadyAdded = virtualSlots.some((s) => s.date === override.date && s.time === override.time);
      if (!alreadyAdded) {
        virtualSlots.push(override);
      }
    }

    // Ordenar por fecha y hora
    return virtualSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  }
  

  async findAllByClub(clubId: string) {
    return this.templateRepo.find({
      where: {
        club: { id: clubId },
      },
      order: { createdAt: 'DESC' },
    })
  }
  
}
