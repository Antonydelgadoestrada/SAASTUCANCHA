import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { addDays, eachDayOfInterval, format, parseISO, startOfDay } from 'date-fns';
import { CourtScheduleEvent } from './court_schedule_event.entity';
import { CourtService } from '../court/court.service';
import { CreateCourtScheduleEventDto } from './dto/create-court-schedule-event.dto';

export type ExpandedEventSlot = {
  date: string;
  /** HH:mm — inicio de la celda de 30 min (clave alineada al calendario). */
  time: string;
  /** HH:mm — fin de **esta** celda (`time` + 30 min). */
  slotEnd: string;
  /** HH:mm — inicio del `timeRanges` del evento (mismo valor en cada celda del rango). */
  rangeStart: string;
  /** HH:mm — fin **exclusivo** del `timeRanges` (`until`); la última celda empieza antes de este instante. */
  rangeUntil: string;
  status: 'event';
  eventId: string;
  name: string;
};

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

@Injectable()
export class CourtScheduleEventService {
  constructor(
    @InjectRepository(CourtScheduleEvent)
    private readonly eventRepo: Repository<CourtScheduleEvent>,
    private readonly courtService: CourtService,
  ) {}

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  /** Normaliza a HH:mm; acepta filas legacy. */
  private normalizeSlotTime(raw: unknown): string {
    if (raw == null) return '';
    const s = String(raw).trim();
    if (/^\d{1,2}$/.test(s)) {
      const h = Math.min(23, Math.max(0, parseInt(s, 10)));
      return `${String(h).padStart(2, '0')}:00`;
    }
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return s;
    const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private rangeUntil(r: { until?: string; end?: string }): string {
    const raw = (r as any).until ?? (r as any).end ?? '';
    return this.normalizeSlotTime(raw);
  }

  private rangeStart(r: { start?: string }): string {
    return this.normalizeSlotTime((r as any).start ?? '');
  }

  /** Etiqueta HH:mm tras sumar 30 minutos (tope 23:59 el mismo día). */
  private add30MinLabel(time: string): string {
    const next = Math.min(this.timeToMinutes(time) + 30, 24 * 60 - 1);
    const hh = Math.floor(next / 60)
      .toString()
      .padStart(2, '0');
    const mm = (next % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** Half-open [start, end): every 30-min label HH:mm from start inclusive until before end */
  private expandHalfHourRange(start: string, end: string): string[] {
    const a = this.timeToMinutes(start);
    const b = this.timeToMinutes(end);
    if (b <= a) return [];
    const out: string[] = [];
    for (let m = a; m < b; m += 30) {
      const hh = Math.floor(m / 60)
        .toString()
        .padStart(2, '0');
      const mm = (m % 60).toString().padStart(2, '0');
      out.push(`${hh}:${mm}`);
    }
    return out;
  }

  private dayMatchesWeekly(d: Date, weekdays: string[]): boolean {
    const key = DAY_KEYS[d.getDay()];
    const set = new Set(weekdays.map((w) => String(w).toLowerCase()));
    return set.has(key);
  }

  private dayMatchesMonthly(d: Date, dayOfMonth: number): boolean {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const target = Math.min(dayOfMonth, last);
    return d.getDate() === target;
  }

  private dayMatchesCustom(d: Date, startStr: string, endStr: string): boolean {
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= startStr && ds <= endStr;
  }

  /** Misma regla que en `expandForCourt` para saber si un evento aplica en una fecha concreta. */
  private dayMatchesRecurrence(
    d: Date,
    type: string,
    cfg: Record<string, unknown>,
  ): boolean {
    const t = String(type || '').toLowerCase();
    if (t === 'weekly') {
      const weekdays = (cfg as any).weekdays;
      if (Array.isArray(weekdays)) {
        return this.dayMatchesWeekly(d, weekdays.map(String));
      }
      return false;
    }
    if (t === 'monthly') {
      const dom = Number((cfg as any).dayOfMonth);
      if (!Number.isNaN(dom) && dom >= 1 && dom <= 31) {
        return this.dayMatchesMonthly(d, dom);
      }
      return false;
    }
    if (t === 'custom') {
      const datesArr = (cfg as any).dates;
      if (Array.isArray(datesArr) && datesArr.length > 0) {
        const set = new Set(datesArr.map((x: unknown) => String(x)));
        return set.has(format(d, 'yyyy-MM-dd'));
      }
      const s = String((cfg as any).startDate || '');
      const e = String((cfg as any).endDate || '');
      if (s && e) return this.dayMatchesCustom(d, s, e);
      return false;
    }
    return false;
  }

  /** Intervalos [a,b) en minutos desde medianoche; solape si comparten al menos un instante. */
  private halfOpenRangesOverlapMinutes(a0: number, a1: number, b0: number, b1: number): boolean {
    return a0 < b1 && b0 < a1;
  }

  private normalizedRangesFromDto(
    ranges: { start?: string; until?: string; end?: string }[],
  ): { start: string; until: string }[] {
    return (Array.isArray(ranges) ? ranges : []).map((r) => ({
      start: this.rangeStart(r as any),
      until: this.rangeUntil(r as any),
    }));
  }

  /** ¿Algún par de rangos horarios se cruza el mismo día (reloj)? */
  private anyClockTimeRangesOverlap(
    ra: { start: string; until: string }[],
    rb: { start: string; until: string }[],
  ): boolean {
    for (const x of ra) {
      const x0 = this.timeToMinutes(x.start);
      const x1 = this.timeToMinutes(x.until);
      if (x1 <= x0) continue;
      for (const y of rb) {
        const y0 = this.timeToMinutes(y.start);
        const y1 = this.timeToMinutes(y.until);
        if (y1 <= y0) continue;
        if (this.halfOpenRangesOverlapMinutes(x0, x1, y0, y1)) return true;
      }
    }
    return false;
  }

  /**
   * Primera fecha (desde `from` inclusive) en que ambas recurrencias aplican, o null si no hay en el horizonte.
   * Horizonte amplio para capturar fechas `custom` lejanas.
   */
  private firstSharedCalendarDay(
    typeA: string,
    cfgA: Record<string, unknown>,
    typeB: string,
    cfgB: Record<string, unknown>,
    from: Date,
    maxDays: number,
  ): Date | null {
    for (let i = 0; i < maxDays; i++) {
      const d = addDays(from, i);
      if (this.dayMatchesRecurrence(d, typeA, cfgA) && this.dayMatchesRecurrence(d, typeB, cfgB)) {
        return d;
      }
    }
    return null;
  }

  private static readonly OVERLAP_SCAN_HORIZON_DAYS = 8000;

  /** Primera fecha citada en recurrencia `custom` (dates[] o startDate), o null. */
  private earliestMentionedDayInConfig(
    type: string,
    cfg: Record<string, unknown>,
  ): Date | null {
    if (String(type || '').toLowerCase() !== 'custom') return null;
    const datesArr = (cfg as any).dates;
    if (Array.isArray(datesArr) && datesArr.length > 0) {
      let minD: Date | null = null;
      for (const x of datesArr) {
        try {
          const d = startOfDay(parseISO(String(x)));
          if (!minD || d.getTime() < minD.getTime()) minD = d;
        } catch {
          /* ignore */
        }
      }
      return minD;
    }
    const s = String((cfg as any).startDate || '');
    if (s) {
      try {
        return startOfDay(parseISO(s));
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Última fecha citada en `custom` (dates[] o endDate), o null. Sirve para alargar el barrido de solapes. */
  private latestMentionedDayInConfig(
    type: string,
    cfg: Record<string, unknown>,
  ): Date | null {
    if (String(type || '').toLowerCase() !== 'custom') return null;
    const datesArr = (cfg as any).dates;
    if (Array.isArray(datesArr) && datesArr.length > 0) {
      let maxD: Date | null = null;
      for (const x of datesArr) {
        try {
          const d = startOfDay(parseISO(String(x)));
          if (!maxD || d.getTime() > maxD.getTime()) maxD = d;
        } catch {
          /* ignore */
        }
      }
      return maxD;
    }
    const e = String((cfg as any).endDate || '');
    if (e) {
      try {
        return startOfDay(parseISO(e));
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Inicio del barrido: hoy o la fecha mínima relevante en configs custom (evita perder solapes muy futuros). */
  private overlapScanStart(
    typeA: string,
    cfgA: Record<string, unknown>,
    typeB: string,
    cfgB: Record<string, unknown>,
  ): Date {
    const today = startOfDay(new Date());
    const candidates: Date[] = [today];
    const e1 = this.earliestMentionedDayInConfig(typeA, cfgA);
    const e2 = this.earliestMentionedDayInConfig(typeB, cfgB);
    if (e1) candidates.push(e1);
    if (e2) candidates.push(e2);
    return candidates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
  }

  private static readonly OVERLAP_SCAN_MAX_DAYS_CAP = 25000;

  /**
   * Días a barrer desde `from`: al menos el horizonto base, y si hay fechas custom lejanas,
   * hasta cubrir la última fecha relevante (evita falsos negativos entre semanal/mensual vs personalizado).
   */
  private overlapScanMaxDays(
    typeA: string,
    cfgA: Record<string, unknown>,
    typeB: string,
    cfgB: Record<string, unknown>,
    from: Date,
  ): number {
    const base = CourtScheduleEventService.OVERLAP_SCAN_HORIZON_DAYS;
    const la = this.latestMentionedDayInConfig(typeA, cfgA);
    const lb = this.latestMentionedDayInConfig(typeB, cfgB);
    let latest: Date | null = null;
    if (la && (!latest || la.getTime() > latest.getTime())) latest = la;
    if (lb && (!latest || lb.getTime() > latest.getTime())) latest = lb;
    if (!latest) return base;
    const spanMs = latest.getTime() - from.getTime();
    if (spanMs <= 0) return base;
    const extraDays = Math.ceil(spanMs / (24 * 60 * 60 * 1000)) + 31;
    return Math.min(Math.max(base, extraDays), CourtScheduleEventService.OVERLAP_SCAN_MAX_DAYS_CAP);
  }

  private bloqueoTipoLabel(recurrenceType: string): string {
    const t = String(recurrenceType || '').toLowerCase();
    if (t === 'weekly') return 'semanal';
    if (t === 'monthly') return 'mensual';
    if (t === 'custom') return 'personalizado';
    return t || 'desconocido';
  }

  /**
   * Dos definiciones de evento chocan si comparten al menos un día de calendario (en el horizonte)
   * y los rangos horarios se solapan en convención [start, until) como en el calendario.
   * Aplica entre cualquier par de tipos (semanal / mensual / personalizado).
   */
  private eventsDefinitionOverlap(
    typeA: string,
    cfgA: Record<string, unknown>,
    rangesA: { start: string; until: string }[],
    typeB: string,
    cfgB: Record<string, unknown>,
    rangesB: { start: string; until: string }[],
  ): boolean {
    if (!this.anyClockTimeRangesOverlap(rangesA, rangesB)) return false;
    const from = this.overlapScanStart(typeA, cfgA, typeB, cfgB);
    const maxDays = this.overlapScanMaxDays(typeA, cfgA, typeB, cfgB, from);
    return (
      this.firstSharedCalendarDay(
        typeA,
        cfgA,
        typeB,
        cfgB,
        from,
        maxDays,
      ) !== null
    );
  }

  /** Comprueba solape contra todos los eventos de la cancha, sea cual sea su tipo de bloqueo / recurrencia. */
  private async assertNoOverlappingCourtEvent(dto: CreateCourtScheduleEventDto): Promise<void> {
    const newRanges = this.normalizedRangesFromDto(dto.timeRanges as any);
    const newType = String(dto.recurrenceType || '').toLowerCase();
    const newCfg = (dto.recurrenceConfig || {}) as Record<string, unknown>;

    const others = await this.eventRepo.find({
      where: { courtId: dto.courtId },
      order: { createdAt: 'ASC' },
    });

    for (const ev of others) {
      const oldRanges = this.normalizedRangesFromDto(ev.timeRanges as any);
      const oldType = String(ev.recurrenceType || '').toLowerCase();
      const oldCfg = (ev.recurrenceConfig || {}) as Record<string, unknown>;
      if (
        this.eventsDefinitionOverlap(
          newType,
          newCfg,
          newRanges,
          oldType,
          oldCfg,
          oldRanges,
        )
      ) {
        const tipoExistente = this.bloqueoTipoLabel(ev.recurrenceType);
        throw new BadRequestException(
          `Este horario se solapa con el evento existente «${ev.name}» (bloqueo ${tipoExistente}) en la misma cancha. Ajusta días u horarios o elimina el otro evento.`,
        );
      }
    }
  }

  private async assertCourtInClub(courtId: string, clubId: string) {
    const court: any = await this.courtService.findOne(courtId, ['venue', 'venue.club']);
    if (!court?.venue?.club?.id) throw new ForbiddenException('Cancha no encontrada');
    if (court.venue.club.id !== clubId) {
      throw new ForbiddenException('No tienes acceso a esta cancha');
    }
    return court;
  }

  private validateRecurrence(dto: CreateCourtScheduleEventDto) {
    const type = String(dto.recurrenceType || '').toLowerCase();
    const cfg = dto.recurrenceConfig || {};

    if (!Array.isArray(dto.timeRanges) || dto.timeRanges.length === 0) {
      throw new BadRequestException('Debe haber al menos un rango horario');
    }
    for (const r of dto.timeRanges) {
      const startS = this.rangeStart(r);
      const untilS = this.rangeUntil(r as any);
      const startM = this.timeToMinutes(startS);
      const endM = this.timeToMinutes(untilS);
      if (!startS || !untilS || endM <= startM) {
        throw new BadRequestException('Cada rango debe tener inicio y fin válidos (fin > inicio)');
      }
    }

    if (type === 'weekly') {
      const weekdays = (cfg as any).weekdays;
      if (!Array.isArray(weekdays) || weekdays.length === 0) {
        throw new BadRequestException('Recurrencia semanal: indica al menos un día (weekdays)');
      }
    } else if (type === 'monthly') {
      const dom = Number((cfg as any).dayOfMonth);
      if (Number.isNaN(dom) || dom < 1 || dom > 31) {
        throw new BadRequestException('Recurrencia mensual: dayOfMonth entre 1 y 31');
      }
    } else if (type === 'custom') {
      const dates = (cfg as any).dates;
      const s = String((cfg as any).startDate || '');
      const e = String((cfg as any).endDate || '');
      const hasDates = Array.isArray(dates) && dates.length > 0;
      if (!hasDates && (!s || !e)) {
        throw new BadRequestException(
          'Recurrencia personalizada: usa dates[] (fechas ISO yyyy-MM-dd) o startDate y endDate',
        );
      }
    } else {
      throw new BadRequestException('recurrenceType debe ser weekly, monthly o custom');
    }
  }

  async listByCourt(courtId: string, clubId: string): Promise<CourtScheduleEvent[]> {
    await this.assertCourtInClub(courtId, clubId);
    return this.eventRepo.find({
      where: { courtId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateCourtScheduleEventDto, clubId: string): Promise<CourtScheduleEvent> {
    const court = await this.assertCourtInClub(dto.courtId, clubId);
    this.validateRecurrence(dto);

    const linkedId = (court as any).schedule_template_id ?? null;
    if (!linkedId) {
      throw new BadRequestException(
        'La cancha debe tener una plantilla de horarios asignada antes de crear eventos',
      );
    }
    if (dto.templateId != null && String(dto.templateId) !== String(linkedId)) {
      throw new BadRequestException('La plantilla no coincide con la asignada a esta cancha');
    }

    await this.assertNoOverlappingCourtEvent(dto);

    const row = this.eventRepo.create({
      courtId: dto.courtId,
      templateId: linkedId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      recurrenceType: dto.recurrenceType,
      recurrenceConfig: dto.recurrenceConfig,
      timeRanges: dto.timeRanges.map((r) => ({
        start: this.rangeStart(r),
        until: this.rangeUntil(r as any),
      })),
      price: dto.price ?? 0,
      isActive: dto.isActive !== false,
    });
    return this.eventRepo.save(row);
  }

  async deleteById(eventId: string, clubId: string): Promise<void> {
    const ev = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!ev) throw new NotFoundException('Evento no encontrado');
    await this.assertCourtInClub(ev.courtId, clubId);
    await this.eventRepo.remove(ev);
  }

  async expandForCourt(
    courtId: string,
    startDate: string,
    endDate: string,
    clubId: string,
  ): Promise<ExpandedEventSlot[]> {
    await this.assertCourtInClub(courtId, clubId);

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = eachDayOfInterval({ start, end });

    const events = await this.eventRepo.find({
      where: { courtId, isActive: true },
      order: { createdAt: 'ASC' },
    });

    const result: ExpandedEventSlot[] = [];
    const seen = new Set<string>();

    for (const ev of events) {
      const ranges = Array.isArray(ev.timeRanges) ? ev.timeRanges : [];
      const type = String(ev.recurrenceType || '').toLowerCase();
      const cfg = ev.recurrenceConfig || {};

      for (const d of days) {
        const dateStr = format(d, 'yyyy-MM-dd');
        if (!this.dayMatchesRecurrence(d, type, cfg)) continue;

        for (const r of ranges) {
          const startT = this.rangeStart(r as any);
          const endT = this.rangeUntil(r as any);
          const times = this.expandHalfHourRange(startT, endT);
          for (const time of times) {
            const key = `${dateStr}|${time}|${ev.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({
              date: dateStr,
              time,
              slotEnd: this.add30MinLabel(time),
              rangeStart: startT,
              rangeUntil: endT,
              status: 'event',
              eventId: ev.id,
              name: ev.name,
            });
          }
        }
      }
    }

    return result;
  }

}
