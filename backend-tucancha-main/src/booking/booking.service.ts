import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './booking.entity';
import { Repository } from 'typeorm';
import { ScheduleTemplateService } from '../schedule/schedule-template.service';
import { CreateBookingDto, CreateManualBookingDto } from './create-booking.dto';
import { BookingStatus } from './booking-status.enum';
import { PaymentStatus } from '../payment/payment-status.enum';
import { CourtService } from '../court/court.service';
import { MercadoPagoService } from '../mecado-pago/mercado-pago.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { In } from 'typeorm';
import { addMinutes, format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Club } from '../club/club.entity';
import { Court } from '../court/court.entity';

import { S3Service } from '../aws/s3.service';
import { MailerService } from '../mailer/mailer.service';
import { isNight } from '../helpers/helpers';

function generateTimeSlots(start: string, duration: number): string[] {
  const [hours, minutes] = start.split(':').map(Number);
  const startDate = new Date(0, 0, 0, hours, minutes);

  const numberOfSlots = duration * 2; // porque 0.5h = 30min
  const slots: string[] = [];

  for (let i = 0; i < numberOfSlots; i++) {
    const slotTime = addMinutes(startDate, i * 30);
    slots.push(format(slotTime, 'HH:mm'));
  }

  return slots;
}

const getEndTime = (startTime: string, duration: number): string => {
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutesToAdd = duration * 60;

  const startDate = new Date();
  startDate.setHours(h, m, 0, 0);
  startDate.setMinutes(startDate.getMinutes() + totalMinutesToAdd);

  const endHours = startDate.getHours().toString().padStart(2, "0");
  const endMinutes = startDate.getMinutes().toString().padStart(2, "0");

  return `${endHours}:${endMinutes}`;
};


@Injectable()
export class BookingService {
  
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly scheduleTemplateService: ScheduleTemplateService,
    private readonly courtService: CourtService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly userService: UserService,

    private readonly mailerService: MailerService,
    private readonly s3Service: S3Service,


  ) {}

  async checkAvailability(courtId: string, date: Date, startTime: string, duration:number) {
    const times = generateTimeSlots(startTime, duration); // ← Generamos bloques
    const dateStr = new Date(date).toISOString().split('T')[0];
    const slots = await this.scheduleTemplateService.getAvailabilityByCourtAndDates(courtId, dateStr, dateStr);
    const requestedSlots = slots.filter((s: any) => times.includes(s.time));
  
    if (requestedSlots.length !== times.length || requestedSlots.some((s: any) => s.status === 'occupied' || s.status === 'on-hold' || s.status === 'event')) {
      throw new BadRequestException('Uno o más horarios no están disponibles.');
    }
    return requestedSlots;
  }

  async getSlots(courtId: string, date: Date, startTime: string, duration:number){
    const times = generateTimeSlots(startTime, duration); // ← Generamos bloques
    const dateStr = new Date(date).toISOString().split('T')[0];
    const slots = await this.scheduleTemplateService.getAvailabilityByCourtAndDates(courtId, dateStr, dateStr);
    return slots.filter((s: any) => times.includes(s.time));
  }

  async findAllByUser(user: Partial<User>){
    return this.bookingRepo.find({
      where:{
        user: { id: user.id },
      },
      relations: ['court', 'court.club', 'club', 'payment'],
      order: {
        date: 'DESC', // 👈 ordenar por fecha descendente
      },
    })
  }

  async findAllByClub(club:Partial<Club>){
      return this.bookingRepo.find({
        where:{
          club: { id: club.id },
        },
        relations: ['court', 'court.club', 'club', 'user', 'payment'],
        order: {
          date: 'DESC', // 👈 ordenar por fecha descendente
        },
      })
  }

  uploadFile(image){
    return this.s3Service.uploadFile(image.buffer,
      image.originalname,
      image.mimetype,
      `public/bookings`)
  }

 async createObjectBooking(dto: any, user: User){
  const { userEmail, duration, startTime, courtId, date, customerInfo } = dto;
  const userReservation = await this.userService.findByEmail(userEmail);
  if(!userReservation) throw new NotFoundException(`email: ${userEmail} no encontrado`)
  const court: any = await this.courtService.findOne(courtId , ['club']);
  const endTime = getEndTime(startTime, duration);
  if (!court) throw new NotFoundException('Cancha no encontrada');
  const price = isNight()
  ? court.promoNight ?? court.priceNight
  : court.promoDay ?? court.priceDay;

  return {
    user,
    court,
    club: court.club,
    date: new Date(date),
    startTime: startTime,
    endTime: endTime,
    duration: duration,
    customerInfo:{
      name: customerInfo?.name || dto.name || userReservation.name || user?.name || 'Cliente',
      email: customerInfo?.email || dto.email || userReservation.email || user?.email,
      phone: customerInfo?.phone || dto.phone || userReservation.phone || user?.phone || '',
      notes: customerInfo?.notes || dto.notes || '',
    },
    pricing:{
      basePrice: +price,
      discounts: 0,
      taxes: 0,
      totalPrice: +price*duration*2
    },
    bookingReference: `REF-${Date.now()}`,
  }
 }

 async cancelBooking(dto:any){
  const booking = await this.findOneComplete(dto.id)
  booking.status = BookingStatus.CANCELLED;
  booking.paymentStatus = PaymentStatus.REJECTED;
  let slots = await this.getSlots(dto.court.id, dto.date, dto.startTime, dto.duration);
  const data = await this.bookingRepo.create(booking);
  const result =  await this.bookingRepo.save(data)
  slots= slots.map((slot)=>(Object.assign(slot, { status: 'available' })))
  await this.scheduleTemplateService.bulkUpdate(slots);
  await this.mailerService.sendBookingCancelledEmail(result.customerInfo.email, result);
  return booking;
 }

 async paymentManualBooking(dto:any){
  const booking = await this.findOneComplete(dto.id);
  if(booking.paymentStatus ==PaymentStatus.PAID ) throw new BadRequestException('La reserva ya ha sido pagada')
  booking.status = BookingStatus.CONFIRMED;
  booking.paymentStatus = PaymentStatus.PAID;
  booking.paymentMethod = 'manual';
  let slots = await this.getSlots(dto.court.id, dto.date, dto.startTime, dto.duration);
  const data = await this.bookingRepo.create(booking);
  const result =  await this.bookingRepo.save(data)
  slots= slots.map((slot)=>(Object.assign(slot, { status: 'occupied' })))
  await this.scheduleTemplateService.bulkUpdate(slots);
  await this.mailerService.sendBookingPaidNotifications(result);
  return booking;
}

  async createOnlineBooking(dto: any, user: User) {
    const statusManual = {
      status: BookingStatus.PENDING,
      paymentMethod: dto.paymentMethod || 'online',
      paymentStatus: PaymentStatus.PENDING,
    }
    let slots = await this.checkAvailability(dto.courtId, dto.date, dto.startTime, dto.duration);
 
    let booking = await this.createObjectBooking(dto, user);
    booking = Object.assign(booking, statusManual);
    const saveBooking = await this.bookingRepo.create(booking);
    const result = await this.bookingRepo.save(saveBooking);
    slots= slots.map((slot)=>(Object.assign(slot, { status: 'on-hold' })))
    await this.scheduleTemplateService.bulkUpdate(slots);
    // 📩 Enviar correo de confirmación
    await this.mailerService.sendBookingReservationNotifications(result);
    return result;
 }

  async createManualBooking(dto: CreateManualBookingDto, user: User) {
    const userReservation = await this.userService.findByEmail(dto.userEmail);
    const pricing = dto.pricing ? JSON.parse(dto.pricing) : null;
    if(!userReservation) throw new NotFoundException(`email: ${dto.userEmail} no encontrado`)
    let slots = await this.checkAvailability(dto.courtId, dto.date, dto.startTime, dto.duration);
    const court: any = await this.courtService.findOne(dto.courtId , ['club']);
    if (!court) throw new NotFoundException('Cancha no encontrada');
    const booking = this.bookingRepo.create({
      user:userReservation,
      court,
      club: user.club,
      date: new Date(dto.date),
      startTime: dto.startTime,
      endTime: dto.endTime,
      duration: dto.duration,
      customerInfo:{
        name: userReservation.name,
        email: userReservation.email,
        phone: userReservation.phone,
      },
      pricing,
      status: BookingStatus.PENDING,
      paymentMethod:'manual',
      paymentStatus: PaymentStatus.PENDING,
      bookingReference: `REF-${Date.now()}`,
    });
    const result = await this.bookingRepo.save(booking);
    // slots= slots.map((slot)=>(Object.assign(slot, { status: 'occupied' })))
    slots= slots.map((slot)=>(Object.assign(slot, { status: 'on-hold' })))
    await this.scheduleTemplateService.bulkUpdate(slots);
    // 📩 Enviar correo de reserva pagada
    await this.mailerService.sendBookingConfirmationEmail(result.customerInfo.email, result);
    return result;
  }

  async createDeferredBooking(dto: CreateBookingDto, user: User) {
    let slots = await this.checkAvailability(dto.courtId, dto.date, dto.startTime, dto.duration);

    const court = await this.courtService.findOne(dto.courtId);
    if (!court) throw new NotFoundException('Cancha no encontrada');

    const booking = this.bookingRepo.create({
      user,
      court,
      club: court.club,
      date: new Date(dto.date),
      startTime: dto.startTime,
      endTime: dto.endTime,
      duration: dto.duration,
      customerInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      pricing: dto.pricing,
      status: BookingStatus.PENDING,
      paymentMethod: 'online',
      paymentStatus: PaymentStatus.PENDING,
      bookingReference: `REF-${Date.now()}`,
    });

    await this.bookingRepo.save(booking);

    slots = slots.map((slot) => Object.assign(slot, { status: 'on-hold' }));
    await this.scheduleTemplateService.bulkUpdate(slots);
// 📩 Enviar correo de confirmación
    await this.mailerService.sendBookingConfirmationEmail(booking.customerInfo.email, booking);

    // Generar preferencia de pago
    const preference = await this.mercadoPagoService.createPreference({
      id: booking.id,
      title: `Reserva en ${court.name}`,
      description: `Reserva para el día ${dto.date}`,
      quantity: 1,
      unit_price: dto.pricing.totalPrice,
    });

    return {
      booking,
      preferenceId: preference.id,
      initPoint: preference.init_point, // URL para redirigir al usuario
    };
  }

  findAll() {
    return this.bookingRepo.find();
  }

  findOne(id: string) {
    return this.bookingRepo.findOne({ where: { id }, relations: ['user', 'court']});
  }

  findOneComplete(id: string) {
    return this.bookingRepo.findOne({ where: { id }, relations: ['user', 'court', 'club']});
  }

  findOneByClub(id: string) {
    return this.bookingRepo.findOne({ where: { id }, relations: ['club']});
  }

  create(data: Partial<Booking>) {
    const booking = this.bookingRepo.create(data);
    return this.bookingRepo.save(booking);
  }

  async update(id: string, data: Partial<Booking>) {
    await this.bookingRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    return this.bookingRepo.delete(id);
  }

  async getPopularCourtsByClub(
    clubId: string,
    startDate: Date,
    endDate: Date
  ) {
    const result = await this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoin('booking.court', 'court')
      .select('court.id', 'id')
      .addSelect('court.name', 'name')
      .addSelect('COUNT(booking.id)', 'bookings')
      .addSelect('SUM((booking.pricing->>\'totalPrice\')::numeric)', 'revenue')
      .where('booking.club.id = :clubId', { clubId })
      .andWhere('booking.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('booking.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('court.id')
      .addGroupBy('court.name')
      .orderBy('bookings', 'DESC')
      .limit(5)
      .getRawMany();
  
      const formatted = result.map((item) => ({
        id: item.id,
        name: item.name,
        bookings: Number(item.bookings),
        revenue: Number(item.revenue),
      }));
    
      // Encuentra el máximo de bookings
      const maxBookings = Math.max(...formatted.map(c => c.bookings));
      // Retorna con occupancyRate normalizado
      return formatted.map(court => ({
        ...court,
        occupancyRate: maxBookings > 0 ? Math.round((court.bookings / maxBookings) * 100) : 0
      }));
  }

  async getDailyStatsByClub(
    clubId: string,
    startDate: Date,
    endDate: Date
  ) {
    const result = await this.bookingRepo
      .createQueryBuilder('booking')
      .select("TO_CHAR(booking.date, 'DD/MM')", 'name')
      .addSelect('COUNT(booking.id)', 'reservas')
      .addSelect('SUM((booking.pricing->>\'totalPrice\')::numeric)', 'ingresos')
      .where('booking.club.id = :clubId', { clubId })
      .andWhere('booking.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('booking.paymentStatus = :paidStatus', { paidStatus: 'paid' })
      .groupBy('name')
      .orderBy('MIN(booking.date)', 'ASC')
      .getRawMany();
  
    return result.map((row) => ({
      name: row.name,
      reservas: Number(row.reservas),
      ingresos: Number(row.ingresos),
    }));
  }
 
  async getCountByCloud(clubId: string){
    const courts = await this.courtService.totalByClub(clubId);
    return {
      courts
    }
  }

  async getDashboardSummary(clubId: string, startDate?: Date, endDate?: Date) {
    const revenueQuery = this.bookingRepo
      .createQueryBuilder('booking')
      .select('COUNT(booking.id)', 'totalBookings')
      .addSelect('SUM((booking.pricing->>\'totalPrice\')::numeric)', 'totalRevenue')
      .where('booking.clubId = :clubId', { clubId })
      .andWhere('booking.paymentStatus = :paidStatus', { paidStatus: 'paid' });
  
    if (startDate && endDate) {
      revenueQuery.andWhere('booking.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
  
    const totalRevenueResult = await revenueQuery.getRawOne();
  
    return {
      revenue: Number(totalRevenueResult.totalRevenue) || 0,
      bookings: Number(totalRevenueResult.totalBookings) || 0,
    };
  }
  

  async getBookingsReportByClub(
    clubId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoin('booking.user', 'user')
      .leftJoin('booking.court', 'court')
      .select([
        'booking.id AS id',
        'booking.date AS date',
        'user.name AS userName',
        'user.email AS userEmail',
        'court.name AS court',
        'booking.duration AS duration',
        "(booking.pricing->>'totalPrice')::numeric AS price",
        'booking.status AS status',
        'booking.paymentMethod AS paymentMethod',
      ])
      .where('booking.club.id = :clubId', { clubId });
  
    if (startDate && endDate) {
      query.andWhere('booking.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }
  
    const result = await query.orderBy('booking.date', 'DESC').getRawMany();
  
    return result.map((row) => ({
      id: row.id,
      date: row.date,
      userName: row.userName,
      userEmail: row.useremail,
      court: row.court,
      duration: Number(row.duration),
      price: Number(row.price),
      status: row.status,
      paymentMethod: row.paymentmethod,
    }));
  }

  async getHourlyOccupancyDemand(
    clubId: string,
    startDate: Date,
    endDate: Date,
    sport?: string,
    courtId?: string,
  ) {
    // 1. Obtener todas las canchas activas del club
    const courtsQuery = this.bookingRepo.manager.getRepository(Court)
      .createQueryBuilder('court')
      .leftJoin('court.club', 'club')
      .where('club.id = :clubId', { clubId })
      .andWhere('court.isActive = true');

    const allClubCourts = await courtsQuery.getMany();

    // Extraer lista de deportes únicos disponibles
    const availableSports = Array.from(
      new Set(
        allClubCourts
          .map((c) => (c.type ? c.type.trim().toLowerCase() : ''))
          .filter(Boolean)
      )
    );

    // Filtrar canchas según deporte o courtId
    let filteredCourts = allClubCourts;
    if (sport && sport !== 'all') {
      filteredCourts = filteredCourts.filter(
        (c) => c.type && c.type.trim().toLowerCase() === sport.trim().toLowerCase()
      );
    }
    if (courtId && courtId !== 'all') {
      filteredCourts = filteredCourts.filter((c) => c.id === courtId);
    }

    const courtCount = filteredCourts.length || 1;
    const filteredCourtIds = filteredCourts.map((c) => c.id);

    // 2. Calcular ocurrencia de cada día de la semana en el rango de fechas
    // 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
    const dayOfWeekOccurrences: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const curDate = new Date(startDate);
    const finalDate = new Date(endDate);

    while (curDate <= finalDate) {
      const dow = curDate.getDay();
      dayOfWeekOccurrences[dow] = (dayOfWeekOccurrences[dow] || 0) + 1;
      curDate.setDate(curDate.getDate() + 1);
    }

    for (let d = 0; d < 7; d++) {
      if (!dayOfWeekOccurrences[d]) dayOfWeekOccurrences[d] = 1;
    }

    // 3. Buscar todas las reservas del club en el rango de fechas y canchas seleccionadas
    let bookings: Booking[] = [];
    if (filteredCourtIds.length > 0) {
      const bookingQuery = this.bookingRepo
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.court', 'court')
        .leftJoin('booking.club', 'club')
        .where('club.id = :clubId', { clubId })
        .andWhere('booking.date BETWEEN :startDate AND :endDate', { startDate, endDate })
        .andWhere('booking.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere('court.id IN (:...filteredCourtIds)', { filteredCourtIds });

      bookings = await bookingQuery.getMany();
    }

    // 4. Inicializar Matriz 7 Días x 18 Horas (06:00 a 23:00)
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];
    const daysNameMap: Record<number, string> = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      0: 'Domingo',
    };

    const matrix: Record<
      number,
      Record<
        number,
        {
          bookingsCount: number;
          revenue: number;
          capacity: number;
          occupancyRate: number;
          status: 'DEAD' | 'LOW' | 'MEDIUM' | 'PEAK';
        }
      >
    > = {};

    for (const day of daysOrder) {
      matrix[day] = {};
      const occurrences = dayOfWeekOccurrences[day];
      const totalSlotCapacity = occurrences * courtCount;

      for (let hour = 6; hour <= 23; hour++) {
        matrix[day][hour] = {
          bookingsCount: 0,
          revenue: 0,
          capacity: totalSlotCapacity,
          occupancyRate: 0,
          status: 'DEAD',
        };
      }
    }

    // 5. Poblar la matriz con las reservas reales
    for (const b of bookings) {
      const bDate = new Date(b.date);
      const utcDate = new Date(bDate.getUTCFullYear(), bDate.getUTCMonth(), bDate.getUTCDate());
      const dayOfWeek = utcDate.getDay();

      if (!matrix[dayOfWeek]) continue;

      const startH = b.startTime ? parseInt(b.startTime.split(':')[0], 10) : 0;
      const duration = b.duration ? Number(b.duration) : 1;
      const totalPrice = Number(b.pricing?.totalPrice ?? (b as any).price ?? 0);
      const revenuePerHour = duration > 0 ? totalPrice / duration : totalPrice;

      for (let h = startH; h < startH + duration; h++) {
        if (h >= 6 && h <= 23 && matrix[dayOfWeek][h]) {
          matrix[dayOfWeek][h].bookingsCount += 1;
          matrix[dayOfWeek][h].revenue += revenuePerHour;
        }
      }
    }

    // 6. Calcular % de ocupación y status para cada celda
    let totalSlotsEvaluated = 0;
    let totalOccupancySum = 0;
    let deadHoursCount = 0;
    let peakHoursCount = 0;

    const rawSlotList: Array<{
      dayOfWeek: number;
      dayName: string;
      hour: number;
      timeLabel: string;
      bookingsCount: number;
      revenue: number;
      capacity: number;
      occupancyRate: number;
      status: 'DEAD' | 'LOW' | 'MEDIUM' | 'PEAK';
    }> = [];

    for (const day of daysOrder) {
      for (let hour = 6; hour <= 23; hour++) {
        const cell = matrix[day][hour];
        const rate =
          cell.capacity > 0 ? Math.min(100, Math.round((cell.bookingsCount / cell.capacity) * 100)) : 0;

        cell.occupancyRate = rate;
        cell.revenue = Number(cell.revenue.toFixed(2));

        if (rate >= 75) {
          cell.status = 'PEAK';
          peakHoursCount++;
        } else if (rate >= 40) {
          cell.status = 'MEDIUM';
        } else if (rate >= 20) {
          cell.status = 'LOW';
        } else {
          cell.status = 'DEAD';
          deadHoursCount++;
        }

        totalSlotsEvaluated++;
        totalOccupancySum += rate;

        const hourFormatted = `${hour.toString().padStart(2, '0')}:00`;
        const nextHourFormatted = `${(hour + 1).toString().padStart(2, '0')}:00`;

        rawSlotList.push({
          dayOfWeek: day,
          dayName: daysNameMap[day],
          hour,
          timeLabel: `${hourFormatted} - ${nextHourFormatted}`,
          bookingsCount: cell.bookingsCount,
          revenue: cell.revenue,
          capacity: cell.capacity,
          occupancyRate: rate,
          status: cell.status,
        });
      }
    }

    const averageOccupancy =
      totalSlotsEvaluated > 0 ? Math.round(totalOccupancySum / totalSlotsEvaluated) : 0;

    // 7. Encontrar Bloques de Horarios Muertos Recurrentes (Top Dead Blocks)
    const deadBlocks: Array<{
      dayOfWeek: number;
      dayName: string;
      startHour: number;
      endHour: number;
      timeRange: string;
      avgOccupancy: number;
      lostSlotsEstimate: number;
      suggestion: string;
    }> = [];

    for (const day of daysOrder) {
      let blockStart: number | null = null;
      let blockOccupancies: number[] = [];

      for (let h = 6; h <= 23; h++) {
        const cell = matrix[day][h];
        if (cell.status === 'DEAD' || cell.occupancyRate < 20) {
          if (blockStart === null) blockStart = h;
          blockOccupancies.push(cell.occupancyRate);
        } else {
          if (blockStart !== null && blockOccupancies.length >= 2) {
            const avg = Math.round(
              blockOccupancies.reduce((a, b) => a + b, 0) / blockOccupancies.length
            );
            const startStr = `${blockStart.toString().padStart(2, '0')}:00`;
            const endStr = `${h.toString().padStart(2, '0')}:00`;
            deadBlocks.push({
              dayOfWeek: day,
              dayName: daysNameMap[day],
              startHour: blockStart,
              endHour: h,
              timeRange: `${daysNameMap[day]} ${startStr} - ${endStr}`,
              avgOccupancy: avg,
              lostSlotsEstimate: blockOccupancies.length * courtCount,
              suggestion: `Horario muerto recurrente (${avg}% ocupación). Recomendación: Crear promoción "Hora Valle" con 20-30% de descuento o paquetes para academias/estudiantes.`,
            });
          }
          blockStart = null;
          blockOccupancies = [];
        }
      }
      if (blockStart !== null && blockOccupancies.length >= 2) {
        const avg = Math.round(
          blockOccupancies.reduce((a, b) => a + b, 0) / blockOccupancies.length
        );
        const startStr = `${blockStart.toString().padStart(2, '0')}:00`;
        const endStr = `23:59`;
        deadBlocks.push({
          dayOfWeek: day,
          dayName: daysNameMap[day],
          startHour: blockStart,
          endHour: 24,
          timeRange: `${daysNameMap[day]} ${startStr} - ${endStr}`,
          avgOccupancy: avg,
          lostSlotsEstimate: blockOccupancies.length * courtCount,
          suggestion: `Horario muerto recurrente (${avg}% ocupación). Recomendación: Ofrecer tarifas promocionales o ajustar iluminación para reducir costos operativos.`,
        });
      }
    }

    deadBlocks.sort((a, b) => a.avgOccupancy - b.avgOccupancy);

    // 8. Encontrar Bloques de Horarios Pico (Top Peak Blocks)
    const peakBlocks: Array<{
      dayOfWeek: number;
      dayName: string;
      startHour: number;
      endHour: number;
      timeRange: string;
      avgOccupancy: number;
      totalRevenue: number;
      suggestion: string;
    }> = [];

    for (const day of daysOrder) {
      let pStart: number | null = null;
      let pOccupancies: number[] = [];
      let pRev = 0;

      for (let h = 6; h <= 23; h++) {
        const cell = matrix[day][h];
        if (cell.status === 'PEAK' || cell.occupancyRate >= 70) {
          if (pStart === null) pStart = h;
          pOccupancies.push(cell.occupancyRate);
          pRev += cell.revenue;
        } else {
          if (pStart !== null && pOccupancies.length >= 1) {
            const avg = Math.round(pOccupancies.reduce((a, b) => a + b, 0) / pOccupancies.length);
            const startStr = `${pStart.toString().padStart(2, '0')}:00`;
            const endStr = `${h.toString().padStart(2, '0')}:00`;
            peakBlocks.push({
              dayOfWeek: day,
              dayName: daysNameMap[day],
              startHour: pStart,
              endHour: h,
              timeRange: `${daysNameMap[day]} ${startStr} - ${endStr}`,
              avgOccupancy: avg,
              totalRevenue: Number(pRev.toFixed(2)),
              suggestion: `Horario de alta demanda (${avg}% ocupación). Recomendación: Mantener tarifa regular/premium y exigir pago del 100% o adelanto estricto.`,
            });
          }
          pStart = null;
          pOccupancies = [];
          pRev = 0;
        }
      }
      if (pStart !== null && pOccupancies.length >= 1) {
        const avg = Math.round(pOccupancies.reduce((a, b) => a + b, 0) / pOccupancies.length);
        const startStr = `${pStart.toString().padStart(2, '0')}:00`;
        const endStr = `23:59`;
        peakBlocks.push({
          dayOfWeek: day,
          dayName: daysNameMap[day],
          startHour: pStart,
          endHour: 24,
          timeRange: `${daysNameMap[day]} ${startStr} - ${endStr}`,
          avgOccupancy: avg,
          totalRevenue: Number(pRev.toFixed(2)),
          suggestion: `Horario de alta demanda (${avg}% ocupación). Recomendación: Proteger con políticas de cancelación estrictas.`,
        });
      }
    }

    peakBlocks.sort((a, b) => b.avgOccupancy - a.avgOccupancy);

    // Estimación de oportunidad económica
    const estimatedRevenueGain = Number((deadHoursCount * 0.3 * 40).toFixed(2));

    return {
      matrix,
      daysOrder,
      daysNameMap,
      hoursRange: Array.from({ length: 18 }, (_, i) => i + 6),
      availableSports,
      filteredCourts: filteredCourts.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      summary: {
        averageOccupancy,
        totalDeadHours: deadHoursCount,
        totalPeakHours: peakHoursCount,
        estimatedRevenueGain,
        totalBookingsEvaluated: bookings.length,
        courtCount,
      },
      deadBlocks: deadBlocks.slice(0, 8),
      peakBlocks: peakBlocks.slice(0, 8),
      slots: rawSlotList,
    };
  }

  async getDemandTrendStats(
    clubId: string,
    timeframe?: 'day' | 'week' | 'month',
    dateStr?: string,
    courtId?: string,
    sport?: string,
    customStartDate?: string,
    customEndDate?: string,
  ) {
    const baseDate = dateStr ? new Date(dateStr) : new Date();

    // 1. Obtener canchas del club (para filtros y lista de canchas)
    const courtsQuery = this.bookingRepo.manager.getRepository(Court)
      .createQueryBuilder('court')
      .leftJoin('court.club', 'club')
      .where('club.id = :clubId', { clubId })
      .andWhere('court.isActive = true');

    const allCourts = await courtsQuery.getMany();

    let filteredCourts = allCourts;
    if (sport && sport !== 'all') {
      filteredCourts = filteredCourts.filter(
        (c) => c.type && c.type.trim().toLowerCase() === sport.trim().toLowerCase()
      );
    }
    if (courtId && courtId !== 'all') {
      filteredCourts = filteredCourts.filter((c) => c.id === courtId);
    }

    const filteredCourtIds = filteredCourts.map((c) => c.id);

    // 2. Determinar rango de fechas según inputs
    let startDate: string;
    let endDate: string;
    let isSingleDay = false;
    const series: Array<{
      name: string;
      label: string;
      dateKey?: string;
      hour?: number;
      reservas: number;
      ingresos: number;
    }> = [];

    const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
      if (startDate === endDate) {
        isSingleDay = true;
      } else {
        const startD = new Date(startDate + 'T00:00:00');
        const endD = new Date(endDate + 'T00:00:00');
        const cur = new Date(startD);
        while (cur <= endD) {
          const curStr = format(cur, 'yyyy-MM-dd');
          const dayName = daysShort[cur.getDay()];
          const dayMonth = format(cur, 'dd/MM');
          series.push({
            name: `${dayName} ${dayMonth}`,
            label: format(cur, 'dd/MM/yyyy'),
            dateKey: curStr,
            reservas: 0,
            ingresos: 0,
          });
          cur.setDate(cur.getDate() + 1);
        }
      }
    } else if (timeframe === 'day') {
      const dStr = format(baseDate, 'yyyy-MM-dd');
      startDate = dStr;
      endDate = dStr;
      isSingleDay = true;
    } else if (timeframe === 'week') {
      const endD = new Date(baseDate);
      const startD = subDays(endD, 6);
      startDate = format(startD, 'yyyy-MM-dd');
      endDate = format(endD, 'yyyy-MM-dd');

      const cur = new Date(startD);
      while (cur <= endD) {
        const curStr = format(cur, 'yyyy-MM-dd');
        const dayName = daysShort[cur.getDay()];
        const dayMonth = format(cur, 'dd/MM');
        series.push({
          name: `${dayName} ${dayMonth}`,
          label: `${dayName} ${dayMonth}`,
          dateKey: curStr,
          reservas: 0,
          ingresos: 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const startD = startOfMonth(baseDate);
      const endD = endOfMonth(baseDate);
      startDate = format(startD, 'yyyy-MM-dd');
      endDate = format(endD, 'yyyy-MM-dd');

      const cur = new Date(startD);
      while (cur <= endD) {
        const curStr = format(cur, 'yyyy-MM-dd');
        const dayMonth = format(cur, 'dd/MM');
        series.push({
          name: dayMonth,
          label: format(cur, 'dd/MM/yyyy'),
          dateKey: curStr,
          reservas: 0,
          ingresos: 0,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    if (isSingleDay) {
      for (let h = 6; h <= 23; h++) {
        const hFormatted = `${h.toString().padStart(2, '0')}:00`;
        const nextH = `${(h + 1).toString().padStart(2, '0')}:00`;
        series.push({
          name: hFormatted,
          label: `${hFormatted} - ${nextH}`,
          hour: h,
          reservas: 0,
          ingresos: 0,
        });
      }
    }

    // 3. Consultar reservas confirmadas
    let bookings: Booking[] = [];
    if (filteredCourtIds.length > 0) {
      const bQuery = this.bookingRepo
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.court', 'court')
        .leftJoin('booking.club', 'club')
        .where('club.id = :clubId', { clubId })
        .andWhere('booking.date BETWEEN :startDate AND :endDate', {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        })
        .andWhere('booking.status != :cancelled', { cancelled: 'cancelled' })
        .andWhere('court.id IN (:...filteredCourtIds)', { filteredCourtIds });

      bookings = await bQuery.getMany();
    }

    // 4. Mapear reservas a los puntos de la curva
    for (const b of bookings) {
      const bDate = new Date(b.date);
      const utcDate = new Date(bDate.getUTCFullYear(), bDate.getUTCMonth(), bDate.getUTCDate());
      const bDateStr = format(utcDate, 'yyyy-MM-dd');
      const totalPrice = Number(b.pricing?.totalPrice ?? (b as any).price ?? 0);
      const startH = b.startTime ? parseInt(b.startTime.split(':')[0], 10) : 0;
      const duration = b.duration ? Number(b.duration) : 1;
      const revenuePerHour = duration > 0 ? totalPrice / duration : totalPrice;

      if (timeframe === 'day') {
        for (let h = startH; h < startH + duration; h++) {
          const pt = series.find((p) => p.hour === h);
          if (pt) {
            pt.reservas += 1;
            pt.ingresos += Number(revenuePerHour.toFixed(2));
          }
        }
      } else {
        const pt = series.find((p) => p.dateKey === bDateStr);
        if (pt) {
          pt.reservas += 1;
          pt.ingresos += Number(totalPrice.toFixed(2));
        }
      }
    }

    // 5. Redondear y calcular métricas clave (Pico Máximo y Horario Muerto / Valle)
    let totalRevenue = 0;
    let totalBookings = 0;
    let peakPoint = series[0] || null;
    let valleyPoint = series[0] || null;

    for (const pt of series) {
      pt.ingresos = Number(pt.ingresos.toFixed(2));
      totalRevenue += pt.ingresos;
      totalBookings += pt.reservas;

      if (
        !peakPoint ||
        pt.ingresos > peakPoint.ingresos ||
        (pt.ingresos === peakPoint.ingresos && pt.reservas > peakPoint.reservas)
      ) {
        peakPoint = pt;
      }
      if (!valleyPoint || pt.ingresos < valleyPoint.ingresos) {
        valleyPoint = pt;
      }
    }

    totalRevenue = Number(totalRevenue.toFixed(2));
    const averageRevenue = series.length > 0 ? Number((totalRevenue / series.length).toFixed(2)) : 0;
    const averageBookings = series.length > 0 ? Number((totalBookings / series.length).toFixed(1)) : 0;

    return {
      timeframe,
      startDate,
      endDate,
      series,
      summary: {
        totalRevenue,
        totalBookings,
        averageRevenue,
        averageBookings,
        peakPoint: peakPoint
          ? { label: peakPoint.label || peakPoint.name, ingresos: peakPoint.ingresos, reservas: peakPoint.reservas }
          : null,
        valleyPoint: valleyPoint
          ? { label: valleyPoint.label || valleyPoint.name, ingresos: valleyPoint.ingresos, reservas: valleyPoint.reservas }
          : null,
      },
      courts: allCourts.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    };
  }
}
