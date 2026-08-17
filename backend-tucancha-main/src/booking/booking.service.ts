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
import { addMinutes, format } from 'date-fns';
import { Club } from '../club/club.entity';
import { VenueService } from '../venue/venue.service';
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
    private readonly venueService: VenueService,
    private readonly mailerService: MailerService,
    private readonly s3Service: S3Service,


  ) {}

  async checkAvailability(courtId: string, date: Date, startTime: string, duration:number) {
    const times = generateTimeSlots(startTime, duration); // ← Generamos bloques
    const slots = await this.scheduleTemplateService.findByQuery({
      where: {
        courtId,
        date,
        time: In(times)
      },
    });
  
    if (slots.length !== times.length || slots.some((s) => s.status !== 'available')) {
      throw new BadRequestException('Uno o más horarios no están disponibles.');
    }
    return slots;
  }

  async getSlots(courtId: string, date: Date, startTime: string, duration:number){
    const times = generateTimeSlots(startTime, duration); // ← Generamos bloques
    return await this.scheduleTemplateService.findByQuery({
      where: {
        courtId,
        date,
        time: In(times)
      },
    });
  }

  async findAllByUser(user: Partial<User>){
    return this.bookingRepo.find({
      where:{
        user: { id: user.id },
      },
      relations:['court', 'court.venue'],
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
        relations:['court', 'court.venue'],
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

 async createObjectBooking({userEmail,duration,startTime,endTime , courtId, date}: CreateManualBookingDto, user: User){
  const userReservation = await this.userService.findByEmail(userEmail);
  if(!userReservation) throw new NotFoundException(`email: ${userEmail} no encontrado`)
  const court = await this.courtService.findOne(courtId , ['venue', 'venue.club']);
  endTime = getEndTime(startTime, duration);
  if (!court) throw new NotFoundException('Cancha no encontrada');
  const price = isNight()
  ? court.promoNight ?? court.priceNight
  : court.promoDay ?? court.priceDay;

  return {
    user,
    court,
    club: court.venue.club,
    date: new Date(date),
    startTime: startTime,
    endTime: endTime,
    duration: duration,
    customerInfo:{
      name: userReservation.name,
      email: userReservation.email,
      phone: userReservation.phone,
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

 async createOnlineBooking(dto: CreateManualBookingDto, user: User) {
    const statusManual = {
      status: BookingStatus.PENDING,
      paymentMethod:'online',
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
    const court = await this.courtService.findOne(dto.courtId , ['venue', 'venue.club']);
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
      club: court.venue.club,
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
    return this.bookingRepo.findOne({ where: { id }, relations: ['user', 'court', 'court.venue', 'club']});
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
    const venues = await this.venueService.totalByClub(clubId);
    return {
      courts,
      venues
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
      .leftJoin('court.venue', 'venue')
      .select([
        'booking.id AS id',
        'booking.date AS date',
        'user.name AS userName',
        'user.email AS userEmail',
        'venue.name AS venue',
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
      userEmail: row.userEmail,
      venue: row.venue,
      court: row.court,
      duration: Number(row.duration),
      price: Number(row.price),
      status: row.status,
      paymentMethod: row.paymentmethod,
    }));
  }
  
    
  
}
