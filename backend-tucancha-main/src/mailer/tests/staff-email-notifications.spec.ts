import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '../mailer.service';
import { DataSource } from 'typeorm';
import { Booking } from '../../booking/booking.entity';
import { UserRole } from '../../user/user-role.enum';
import { Club } from '../../club/club.entity';
import { User } from '../../user/user.entity';

describe('FASE 6: Correos y Notificaciones a Recepcionistas', () => {
  let mailerService: MailerService;
  let mockDataSource: Partial<DataSource>;

  const mockClubApproved: Club = {
    id: 'club-uuid-approved',
    name: 'Club TuCancha Pro',
    email: 'contacto@tucanchapro.com',
    status: 'APPROVED',
  } as Club;

  const mockClubSuspended: Club = {
    id: 'club-uuid-suspended',
    name: 'Club TuCancha Pro Suspendido',
    email: 'contacto@tucanchapro.com',
    status: 'SUSPENDED',
  } as Club;

  const mockStaffWithBookings: User = {
    id: 'staff-1',
    email: 'recepcion1@tucanchapro.com',
    name: 'Mario Recepcionista',
    role: UserRole.RECEPCIONISTA,
    isActive: true,
    permissions: ['bookings', 'payments'],
    assignedClubId: mockClubApproved.id,
  } as User;

  const mockStaffWithoutBookings: User = {
    id: 'staff-2',
    email: 'mantenimiento@tucanchapro.com',
    name: 'Lucas Canchas',
    role: UserRole.RECEPCIONISTA,
    isActive: true,
    permissions: ['courts', 'schedules'],
    assignedClubId: mockClubApproved.id,
  } as User;

  const mockStaffDeactivated: User = {
    id: 'staff-3',
    email: 'desactivado@tucanchapro.com',
    name: 'Inactivo',
    role: UserRole.RECEPCIONISTA,
    isActive: false,
    permissions: ['bookings'],
    assignedClubId: mockClubApproved.id,
  } as User;

  let sendEmailSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Club) {
          return {
            findOne: jest.fn().mockImplementation(({ where: { id } }) => {
              if (id === mockClubSuspended.id) {
                return Promise.resolve(mockClubSuspended);
              }
              return Promise.resolve(mockClubApproved);
            }),
          };
        }
        if (entity === User) {
          return {
            find: jest.fn().mockImplementation(({ where }) => {
              if (where.assignedClubId === mockClubSuspended.id) {
                return Promise.resolve([
                  { ...mockStaffWithBookings, assignedClubId: mockClubSuspended.id },
                ]);
              }
              // Simular filtro de BD: assignedClubId, role, isActive: true
              if (where.isActive === true) {
                return Promise.resolve([mockStaffWithBookings, mockStaffWithoutBookings]);
              }
              return Promise.resolve([mockStaffWithBookings, mockStaffWithoutBookings, mockStaffDeactivated]);
            }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
          find: jest.fn().mockResolvedValue([]),
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    mailerService = module.get<MailerService>(MailerService);
    sendEmailSpy = jest.spyOn(mailerService, 'sendEmail').mockResolvedValue({ success: true });
  });

  describe('1. Correo de Bienvenida al Crear Recepcionista (sendStaffWelcomeEmail)', () => {
    it('debe enviar el correo de bienvenida con credenciales, club y botón de acceso', async () => {
      const result = await mailerService.sendStaffWelcomeEmail({
        to: 'nuevo@club.com',
        staffName: 'Pedro Recepcionista',
        clubName: 'Club TuCancha Pro',
        rawPassword: 'PasswordSeguro123!',
      });

      expect(result.success).toBe(true);
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);

      const sentArgs = sendEmailSpy.mock.calls[0][0];
      expect(sentArgs.to).toBe('nuevo@club.com');
      expect(sentArgs.subject).toContain('¡Bienvenido al equipo de Club TuCancha Pro!');
      expect(sentArgs.html).toContain('Pedro Recepcionista');
      expect(sentArgs.html).toContain('PasswordSeguro123!');
      expect(sentArgs.html).toContain('Recepcionista');
      expect(sentArgs.html).toContain('Club TuCancha Pro');
      expect(sentArgs.html).toContain('IR AL PANEL DE CONTROL');
    });
  });

  describe('2. Filtrado de Recepcionistas para Correos de Reservas (getStaffBookingEmails)', () => {
    it('debe incluir únicamente recepcionistas activos que tengan permiso "bookings"', async () => {
      const emails = await mailerService.getStaffBookingEmails(mockClubApproved.id);

      expect(emails).toContain(mockStaffWithBookings.email);
      expect(emails).not.toContain(mockStaffWithoutBookings.email);
      expect(emails).not.toContain(mockStaffDeactivated.email);
    });

    it('no debe enviar notificaciones a recepcionistas si el club está SUSPENDED', async () => {
      const emails = await mailerService.getStaffBookingEmails(mockClubSuspended.id);
      expect(emails).toHaveLength(0);
    });
  });

  describe('3. Notificaciones Operativas de Reserva (sendBookingReservationNotifications & Paid)', () => {
    const mockBooking: Booking = {
      id: 'booking-uuid-1',
      bookingReference: 'TC-1001',
      date: new Date('2026-11-15T00:00:00Z'),
      startTime: '18:00',
      endTime: '19:00',
      paymentStatus: 'pending',
      status: 'pending' as any,
      customerInfo: { name: 'Juan Jugador', email: 'jugador@gmail.com', phone: '999888777' },
      club: mockClubApproved,
      court: { id: 'court-1', name: 'Cancha Sintética 1', club: mockClubApproved } as any,
      pricing: { totalPrice: 120 } as any,
    } as Booking;

    it('sendBookingReservationNotifications debe enviar correo al cliente, al club y al recepcionista autorizado', async () => {
      await mailerService.sendBookingReservationNotifications(mockBooking);

      const recipients = sendEmailSpy.mock.calls.map((c) => c[0].to);
      // 1. Cliente
      expect(recipients).toContain('jugador@gmail.com');
      // 2. Club oficial
      expect(recipients).toContain('contacto@tucanchapro.com');
      // 3. Recepcionista con permiso de reservas
      expect(recipients).toContain('recepcion1@tucanchapro.com');
      // 4. Recepcionista sin permiso NO debe estar
      expect(recipients).not.toContain('mantenimiento@tucanchapro.com');
    });

    it('sendBookingPaidNotifications debe notificar pago tanto al club como a los recepcionistas con "bookings"', async () => {
      const paidBooking = { ...mockBooking, paymentStatus: 'paid' as any };
      await mailerService.sendBookingPaidNotifications(paidBooking);

      const recipients = sendEmailSpy.mock.calls.map((c) => c[0].to);
      expect(recipients).toContain('jugador@gmail.com');
      expect(recipients).toContain('contacto@tucanchapro.com');
      expect(recipients).toContain('recepcion1@tucanchapro.com');
      expect(recipients).not.toContain('mantenimiento@tucanchapro.com');
    });
  });
});
