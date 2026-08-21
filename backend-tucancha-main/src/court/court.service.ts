import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Court, CourtUpdateDto } from './court.entity';
import { Repository } from 'typeorm';
import { S3Service } from '../aws/s3.service';
import { format } from 'date-fns'
import { isNight } from '../helpers/helpers';
import { FeaturedCourtDto } from './court.dto';
import { ScheduleTemplate } from '../schedule/schedule_template.entity';
import { CourtScheduleAvailability } from '../schedule/court_schedule_availability.entity';
@Injectable()
export class CourtService {
  constructor(
    @InjectRepository(Court)
    private readonly courtRepo: Repository<Court>,
    @InjectRepository(ScheduleTemplate)
    private readonly scheduleTemplateRepo: Repository<ScheduleTemplate>,
    @InjectRepository(CourtScheduleAvailability)
    private readonly availabilityRepo: Repository<CourtScheduleAvailability>,
    private readonly s3Service: S3Service,
  ) {}

  private async getFirstTemplateIdByClubId(clubId: string): Promise<string | null> {
    if (!clubId) return null;
    const tpl = await this.scheduleTemplateRepo
      .createQueryBuilder('t')
      .innerJoin('t.club', 'club', 'club.id = :clubId', { clubId })
      // "primera" => la más antigua
      .orderBy('t.createdAt', 'ASC')
      // Importante: incluir createdAt en el SELECT para evitar
      // "distinctAlias.<col> does not exist" en Postgres.
      .select(['t.id', 't.createdAt'])
      .getOne();

    return tpl?.id ?? null;
  }

  private async applyScheduleTemplateFallback(
    courts: Court[],
    clubIdHint?: string,
  ): Promise<Court[]> {
    if (!courts?.length) return courts;

    // Si ya hay schedule_template_id en todos, no hacemos nada.
    if (courts.every((c: any) => (c as any).schedule_template_id)) return courts;

    // Caso rápido: sabemos el club (findAllByClub)
    if (clubIdHint) {
      const firstId = await this.getFirstTemplateIdByClubId(clubIdHint);
      if (!firstId) return courts;
      return courts.map((c: any) => {
        if (!c.schedule_template_id) c.schedule_template_id = firstId;
        return c;
      });
    }

    // Caso general: inferir club por cada court (requiere venue.club cargado).
    const cache = new Map<string, string | null>();
    for (const c of courts as any[]) {
      if (c.schedule_template_id) continue;
      const clubId = c?.venue?.club?.id;
      if (!clubId) continue;
      if (!cache.has(clubId)) {
        cache.set(clubId, await this.getFirstTemplateIdByClubId(clubId));
      }
      const tplId = cache.get(clubId);
      if (tplId) c.schedule_template_id = tplId;
    }
    return courts;
  }

  private toFeaturedDto(court: Court): FeaturedCourtDto {
  const images = Array.isArray((court as any).images)
    ? (court as any).images
    : (court as any).image
      ? [(court as any).image]
      : [];

  const venue: any = (court as any).venue ?? null;

  return {
    id: court.id as any,
    name: court.name,
    images: images.length > 0 ? images : ["/placeholder.svg"],
    priceDay: Number((court as any).priceDay ?? 0),
    priceNight: Number((court as any).priceNight ?? 0),
    promoDay: (court as any).promoDay ?? null,
    promoNight: (court as any).promoNight ?? null,
    // opcionales; si luego guardas rating/reviews, cámbialos aquí
    rating: null,
    reviews: null,
    time: court.minimumBookingTime,
    venue: venue
      ? {
          id: venue.id,
          name: venue.name,
          // intenta primero en JSON location.address; si no, usa address plano
          address: venue?.location?.address ?? venue?.address,
          phone: venue?.phone || venue?.club?.phone || '',
          whatsapp: venue?.club?.whatsapp || venue?.phone || venue?.club?.phone || '',
          yapeNumero: venue?.club?.yapeNumero || '',
          yapeQrUrl: venue?.club?.yapeQrUrl || '',
          plinNumero: venue?.club?.plinNumero || '',
          plinQrUrl: venue?.club?.plinQrUrl || '',
          aceptaMercadopago: venue?.club?.aceptaMercadopago ?? true,
          porcentajeAdelantoDefault: venue?.club?.porcentajeAdelantoDefault ?? 50,
          adelantoMinimo: venue?.club?.adelantoMinimo ?? null,
          clubId: venue?.club?.id || '',
        }
      : undefined,
  };
}

  /**
 * Campos destacados para portada.
 * Retorna los primeros registrados (createdAt ASC).
 * @param limit   cantidad máx. (default 12, tope 50)
 * @param sort    "createdAt:asc" | "createdAt:desc" | "id:asc" | "id:desc"
 * @param onlyWithImage si true, filtra los que no tienen imagen
 */
async findFeaturedPublic(
  {
    limit = 12,
    sort = "createdAt:asc",
    onlyWithImage = false,
  }: { limit?: number; sort?: string; onlyWithImage?: boolean } = {},
): Promise<FeaturedCourtDto[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const [fieldRaw, dirRaw] = (sort || "createdAt:asc").split(":");
  const fieldMap: Record<string, string> = {
    createdAt: "court.createdAt",
    id: "court.id",
  };
  const field = fieldMap[fieldRaw] ?? fieldMap.createdAt;
  const direction: "ASC" | "DESC" = (dirRaw || "asc").toUpperCase() === "DESC" ? "DESC" : "ASC";

  const qb = this.courtRepo
    .createQueryBuilder("court")
    .leftJoinAndSelect("court.venue", "venue")
    .leftJoinAndSelect("venue.club", "club")
    .where("club.status = 'APPROVED'")
    .andWhere(`
      EXISTS (
        SELECT 1
        FROM club_memberships cm
        WHERE cm."clubId" = club.id
          AND cm.status IN ('ACTIVE', 'GRACE')
      )
    `)
    .orderBy(field, direction)
    .take(safeLimit);

  const courts = await qb.getMany();

  let featured = courts.map((c) => this.toFeaturedDto(c));

  if (onlyWithImage) {
    featured = featured.filter((c) => Array.isArray(c.images) && c.images.length > 0);
  }

  return featured;
}

  async findAll() {
    const courts = await this.courtRepo.find({ relations: ['venue', 'venue.club'] });
    return this.applyScheduleTemplateFallback(courts);
  }

  findOne(id: string, relations = ['venue']) {
    return this.courtRepo.findOne({ where: { id }, relations: [...relations] });
  }
  totalByClub(clubId){
    return this.courtRepo.createQueryBuilder('court')
    .innerJoin('court.venue', 'venue')
    .where('venue.clubId = :clubId', { clubId })
    .getCount();
  }

  async findAllByVenueByClub(clubId: string, venueId?: number) {
    const where: any = {
      venue: {
        club: {
          id: clubId,
        },
      },
    }
  
    if (venueId) {
      where.venue.id = venueId
    }
  
    const courts = await this.courtRepo.find({
      where,
      relations: ['venue', 'venue.club'],
    })
    return this.applyScheduleTemplateFallback(courts, clubId);
  }
  uploadFiles(images){
     return this.s3Service.uploadFiles(images, '/curt')
  }

  transformCourts(courtsFromBackend: any[]) {
    return courtsFromBackend
      .map(court => {
        const {
          id,
          name,
          type,
          surface,
          capacity,
          description,
          images,
          venue,
          availabilities,
          minimumBookingTime
        } = court;

        const price = isNight()
          ? court.priceNight
          : court.priceDay;
        const promoPrice = isNight()?court.promoNight: court.promoDay  
  
        const availableSlots = availabilities
          .filter(a => a.status === 'available')
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(a => a.time)
          .filter((time, index, arr) => {
            const getMinutes = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
  
            const current = getMinutes(time);
            const blocksRequired = parseFloat(minimumBookingTime || '1') * 2;
  
            for (let i = 1; i < blocksRequired; i++) {
              const nextTime = arr[index + i];
              if (!nextTime) return false;
  
              const expected = current + i * 30;
              const [h, m] = nextTime.split(':').map(Number);
              const actual = h * 60 + m;
  
              if (actual !== expected) return false;
            }
  
            return true;
          });
        
        return {
          id,
          name,
          venue: venue?.name || '',
          club: venue?.club?.name || '',
          sport: type,
          price: Number(price),
          promoPrice:Number(promoPrice),
          minimumBookingTime,
          rating: 4.5,
          reviews: 128,
          phone: venue?.phone || venue?.club?.phone || '',
          whatsapp: venue?.club?.whatsapp || venue?.phone || venue?.club?.phone || '',
          yapeNumero: venue?.club?.yapeNumero || '',
          yapeQrUrl: venue?.club?.yapeQrUrl || '',
          plinNumero: venue?.club?.plinNumero || '',
          plinQrUrl: venue?.club?.plinQrUrl || '',
          aceptaMercadopago: venue?.club?.aceptaMercadopago ?? true,
          porcentajeAdelantoDefault: venue?.club?.porcentajeAdelantoDefault ?? 50,
          adelantoMinimo: venue?.club?.adelantoMinimo ?? null,
          clubId: venue?.club?.id || '',
          address: venue?.location?.address || '',
          coordinates: venue?.location?.coordinates || { lat: 0, lng: 0 },
          images: images.length > 0 ? images : [
            "/placeholder.svg?height=400&width=600&text=Cancha+Sin+Imagen"
          ],
          description,
          amenities: venue?.services || [],
          availability: availableSlots,
          surface,
          capacity,
        };
      })
      // ⬇️ Filtrar solo las canchas que tengan al menos una franja válida
      .filter(court => court.availability.length > 0);
  }
  
  async getVirtualAvailability(court: Court, dateStr: string): Promise<any[]> {
    const overrides = await this.availabilityRepo.find({
      where: {
        courtId: court.id,
        date: dateStr,
      },
    });

    if (!court.schedule_template_id) {
      return overrides;
    }

    const template = await this.scheduleTemplateRepo.findOne({
      where: { id: court.schedule_template_id },
    });

    if (!template) {
      return overrides;
    }

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
    const targetDate = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = targetDate.getDay();

    if (!enabledDays.includes(dayOfWeek)) {
      return overrides;
    }

    const virtualSlots: any[] = [];
    for (const slot of template.slots) {
      const override = overrides.find((o) => o.time === slot.time);
      if (override) {
        virtualSlots.push(override);
      } else {
        virtualSlots.push({
          courtId: court.id,
          date: dateStr,
          time: slot.time,
          status: slot.status,
        });
      }
    }

    return virtualSlots;
  }

  async findAllWithFilters(query: any) {
    try {
      const { sport, club, date, time, query: textQuery, lat, lng } = query;
      const today = format(new Date(), 'yyyy-MM-dd');
      const targetDate = date || today;
  
      const qb = this.courtRepo.createQueryBuilder("court")
        .leftJoinAndSelect("court.venue", "venue")
        .leftJoinAndSelect("venue.club", "club");
  
      // Filtro estricto: Club debe estar APROBADO y con membresía ACTIVA o en GRACIA
      qb.andWhere("club.status = 'APPROVED'");
      qb.andWhere(`
        EXISTS (
          SELECT 1
          FROM club_memberships cm
          WHERE cm."clubId" = club.id
            AND cm.status IN ('ACTIVE', 'GRACE')
        )
      `);

      // Filtro por deporte
      if (sport && sport !== "all") {
        qb.andWhere("court.type = :sport", { sport });
      }
  
      // Filtro por club
      if (club && club !== "all") {
        qb.andWhere("venue.clubId = :club", { club });
      }
  
      // Filtro por búsqueda textual
      if (textQuery) {
        qb.andWhere(`
          (LOWER(court.name) LIKE :q OR LOWER(court.description) LIKE :q OR LOWER(venue.name) LIKE :q)
        `, { q: `%${textQuery.toLowerCase()}%` });
      }
  
      // Filtro por geolocalización
      if (lat && lng) {
        const radiusKm = 50;
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
  
        qb.andWhere(`
          (
            6371 * acos(
              cos(radians(:lat)) *
              cos(radians((venue.location->'coordinates'->>'lat')::float)) *
              cos(radians((venue.location->'coordinates'->>'lng')::float) - radians(:lng)) +
              sin(radians(:lat)) *
              sin(radians((venue.location->'coordinates'->>'lat')::float))
            )
          ) <= :radius
        `, { lat: latitude, lng: longitude, radius: radiusKm });
  
        qb.addOrderBy(`
          (
            6371 * acos(
              cos(radians(:lat)) *
              cos(radians((venue.location->'coordinates'->>'lat')::float)) *
              cos(radians((venue.location->'coordinates'->>'lng')::float) - radians(:lng)) +
              sin(radians(:lat)) *
              sin(radians((venue.location->'coordinates'->>'lat')::float))
            )
          )
        `, "ASC");
      }
  
      const result = await qb.getMany();
      if (result.length === 0) return [];
  
      const courtsWithVirtual = await Promise.all(
        result.map(async (court) => {
          const virtualAvailabilities = await this.getVirtualAvailability(court, targetDate);
          (court as any).availabilities = virtualAvailabilities;
          return court;
        }),
      );
  
      let transformed = this.transformCourts(courtsWithVirtual);

      if (time && time !== 'all') {
        transformed = transformed.filter((c) => c.availability.includes(time));
      }

      return transformed;
    } catch (error) {
      throw new Error(`Error al filtrar canchas: ${error.message}`);
    }
  }
  
  getValidStartTimes = (availableTimes: string[], selectedDuration: string) => {
    const requiredSlots = {
      "1": 2,
      "1.5": 3,
      "2": 4,
    }[selectedDuration] || 2
  
    const validStartTimes: string[] = []
  
    for (let i = 0; i <= availableTimes.length - requiredSlots; i++) {
      const consecutive = availableTimes.slice(i, i + requiredSlots)
  
      const expected = []
      const base = availableTimes[i]
      const [h, m] = base.split(":").map(Number)
  
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
  
  create(data: any) {
    data.venue = JSON.parse(data.venue)
    const court = this.courtRepo.create(data);
    return this.courtRepo.save(court);
  }

  async update(id: string, data: CourtUpdateDto) {
    if(data.venue) data.venue = JSON.parse(data.venue)

    // Si cambia la plantilla asignada a la cancha, borrar overrides asociados a la plantilla anterior
    // (court_schedule_availability donde templateId == plantilla previa).
    if (Object.prototype.hasOwnProperty.call(data as any, 'schedule_template_id')) {
      const currentCourt = await this.courtRepo.findOne({
        where: { id },
        select: { id: true, schedule_template_id: true } as any,
      });
      const previousTemplateId = (currentCourt as any)?.schedule_template_id ?? null;

      const nextTemplateId = (data as any).schedule_template_id || null;
      if (previousTemplateId && previousTemplateId !== nextTemplateId) {
        await this.availabilityRepo.delete({
          courtId: id,
          templateId: previousTemplateId,
        } as any);
      }
    }
    
    await this.courtRepo.update(id, {...data,  promoDay:
      data.hasOwnProperty('promoDay') && data.promoDay.trim() !== ''
        ? data.promoDay
        : null,
    promoNight:
      data.hasOwnProperty('promoNight') && data.promoNight.trim() !== ''
        ? data.promoNight
        : null,});
    return this.findOne(id);
  }

  remove(id: string) {
    return this.courtRepo.delete(id);
  }

}
