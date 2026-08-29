  import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    UseGuards,

    Body,
    UseInterceptors,
    UploadedFiles,
    InternalServerErrorException,
    UnauthorizedException,
  } from '@nestjs/common';
  import { BookingService } from './booking.service';
  import { Booking } from './booking.entity';
import { CreateBookingDto } from './create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../user/user.entity';
import { GetUser } from '../auth/get-user.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage,  File as MulterFile } from 'multer';

  
  @Controller('bookings')
  export class BookingController {
    constructor(
      private readonly bookingService: BookingService
    ) {}
  
    @Get()
    findAll(): Promise<Booking[]> {
      return this.bookingService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get('/club')
    findAllByClub(@GetUser() user: Partial<User>): Promise<Booking[]> {
      return this.bookingService.findAllByClub(user.club);
    }

    @UseGuards(JwtAuthGuard)
    @Get('/user')
    findAllByUser(@GetUser() user: Partial<User>): Promise<Booking[]> {
      return this.bookingService.findAllByUser(user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('/online')
    createOnlineBooking(
      @Body() dto: any, @GetUser() user: User,
    ){
      return this.bookingService.createOnlineBooking(dto, user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('/online/cancel')
    cancelOnlineBooking(
      @Body() dto: any, @GetUser() user: User,
    ){
      return this.bookingService.cancelBooking(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('/online/payment')
    paymentManualBooking(
      @Body() dto: any, @GetUser() user: User,
    ){
      if(!user.club) throw new UnauthorizedException('No tiene permisos')
      return this.bookingService.paymentManualBooking(dto);
    }
    
    @UseGuards(JwtAuthGuard)
    @Post('manual')
    @UseInterceptors(
      FilesInterceptor('image',1,{
        storage: memoryStorage(), // muy importante: subir desde buffer
      }),
    )
    async createManualBooking(
      @Body() dto: any, @GetUser() user: User,
       @UploadedFiles() image: File[]
    ) {
      const proofOfPaymentUrl = image?.length ? await this.bookingService.uploadFile(image[0]):''
      return this.bookingService.createManualBooking(Object.assign(dto, {proofOfPaymentUrl}), user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('/getPopularCourtsByClub')
    getPopularCourtsByClub(@Body() data:{startDate:Date, endDate:Date}, @GetUser() user: User){
      return this.bookingService.getPopularCourtsByClub(user.club.id, new Date(data.startDate),new Date(data.endDate))
    } 

    @UseGuards(JwtAuthGuard)
    @Post('/getDailyStatsByClub')
    getDailyStatsByClub(@Body() data:{startDate:Date, endDate:Date}, @GetUser() user: User){
      return this.bookingService.getDailyStatsByClub(user.club.id, new Date(data.startDate),new Date(data.endDate))
    }

    @UseGuards(JwtAuthGuard)
    @Post('/getDashboardSummary')
    getDashboardSummary(@Body() data:{startDate:Date, endDate:Date}, @GetUser() user: User){
      return this.bookingService.getDashboardSummary(user.club.id, new Date(data.startDate),new Date(data.endDate))
    } 

    @UseGuards(JwtAuthGuard)
    @Post('/getBookingsReportByClub')
    getBookingsReportByClub(@Body() data:{startDate:Date, endDate:Date}, @GetUser() user: User){
      return this.bookingService.getBookingsReportByClub(user.club.id, new Date(data.startDate),new Date(data.endDate))
    } 

    @UseGuards(JwtAuthGuard)
    @Post('/getHourlyOccupancyDemand')
    getHourlyOccupancyDemand(
      @Body() data: { startDate: Date; endDate: Date; sport?: string; courtId?: string },
      @GetUser() user: User
    ) {
      if (!user?.club?.id) {
        throw new UnauthorizedException('No tiene permisos o no tiene un club asociado');
      }
      return this.bookingService.getHourlyOccupancyDemand(
        user.club.id,
        new Date(data.startDate),
        new Date(data.endDate),
        data.sport,
        data.courtId
      );
    } 

    @UseGuards(JwtAuthGuard)
    @Post('/getDemandTrendStats')
    getDemandTrendStats(
      @Body()
      data: {
        timeframe?: 'day' | 'week' | 'month';
        date?: string;
        courtId?: string;
        sport?: string;
        startDate?: string;
        endDate?: string;
      },
      @GetUser() user: User
    ) {
      if (!user?.club?.id) {
        throw new UnauthorizedException('No tiene permisos o no tiene un club asociado');
      }
      return this.bookingService.getDemandTrendStats(
        user.club.id,
        data.timeframe,
        data.date,
        data.courtId,
        data.sport,
        data.startDate,
        data.endDate
      );
    } 

    @UseGuards(JwtAuthGuard)
    @Post('deferred')
    createDeferredBooking(@Body() dto: CreateBookingDto, @GetUser() user: User) {
      return this.bookingService.createDeferredBooking(dto, user);
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/getCountByClub')
    getCountByCloud(@GetUser() user: User){
      return this.bookingService.getCountByCloud(user.club.id)
    } 
  
    @Get(':id')
    findOne(@Param('id') id: string): Promise<Booking> {
      return this.bookingService.findOne(id);
    }
  
    @Post()
    create(@Body() data: Partial<Booking>) {
      return this.bookingService.create(data);
    }
  
    @Put(':id')
    update(@Param('id') id: string, @Body() data: Partial<Booking>) {
      return this.bookingService.update(id, data);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.bookingService.remove(id);
    }
  
  }
  