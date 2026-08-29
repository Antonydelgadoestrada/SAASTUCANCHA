import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { Booking } from '../booking/booking.entity';

@Injectable()
export class MailerService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private getEmailTemplate({
    title,
    greeting,
    message,
    bookingDetailsHtml,
    footerNote,
  }: {
    title: string;
    greeting: string;
    message: string;
    bookingDetailsHtml?: string;
    footerNote?: string;
  }): string {
    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #16A34A; padding: 20px; text-align: center;">
          <h1 style="color: #fff; margin: 0;">TuCancha</h1>
        </div>
        <div style="padding: 20px; color: #333;">
          <h2 style="color: #16A34A;">${title}</h2>
          <p><strong>${greeting}</strong></p>
          <p>${message}</p>
          ${bookingDetailsHtml || ''}
          <p style="margin-top: 30px; font-size: 13px; color: #777;">
            ${footerNote || 'Gracias por confiar en TuCancha. Si tienes dudas, contáctanos.'}
          </p>
        </div>
        <div style="background-color: #f3f3f3; padding: 10px; text-align: center; font-size: 12px; color: #888;">
          © ${new Date().getFullYear()} TuCancha - Todos los derechos reservados.
        </div>
      </div>
    `;
  }

  private get fromEmail(): string {
    return process.env.RESEND_FROM_EMAIL || 'TuCancha <onboarding@resend.dev>';
  }

  async sendConfirmationEmail(to: string, token: string) {
    const confirmationUrl = `${process.env.SERVICES_URL || 'http://localhost:3001'}/auth/confirm?token=${token}`;

    const html = this.getEmailTemplate({
      title: 'Confirma tu cuenta',
      greeting: '¡Bienvenido a TuCancha!',
      message: `Haz clic en el siguiente enlace para confirmar tu cuenta:<br/><br/>
                <a href="${confirmationUrl}" style="color: #16A34A;">Confirmar cuenta</a>`,
    });

    console.log(`📧 [EMAIL CONFIRMACIÓN URL para ${to}]: ${confirmationUrl}`);

    try {
      if (process.env.RESEND_API_KEY) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject: 'Confirma tu cuenta',
          html,
        });
      }
    } catch (err) {
      console.warn(`⚠️ [MailerService] No se pudo enviar email via Resend a ${to}:`, err?.message || err);
    }
  }

  async sendBookingConfirmationEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, pricing, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: '¡Tu reserva fue confirmada!',
      greeting: `Hola ${customerInfo.name},`,
      message: 'Tu reserva ha sido confirmada con éxito. Aquí los detalles:',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club.name}</li>
          <li><strong>Cancha:</strong> ${court.name}</li>
          <li><strong>Total:</strong> S/ ${pricing?.totalPrice}</li>
        </ul>
      `,
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Tu reserva ha sido confirmada',
      html,
    });
  }

  async sendBookingPaidEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, pricing, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: '¡Pago recibido!',
      greeting: `Hola ${customerInfo.name},`,
      message: 'Hemos recibido tu pago. ¡Tu cancha está asegurada!',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club.name}</li>
          <li><strong>Cancha:</strong> ${court.name}</li>
          <li><strong>Total pagado:</strong> S/ ${pricing?.totalPrice}</li>
        </ul>
      `,
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Tu pago fue recibido con éxito',
      html,
    });
  }

  async sendBookingReservationNotifications(booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, pricing, customerInfo, user } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  
    const detailsUsuario = `
      <ul style="padding-left: 20px;">
        <li><strong>Referencia:</strong> ${bookingReference}</li>
        <li><strong>Fecha:</strong> ${formattedDate}</li>
        <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
        <li><strong>Club:</strong> ${club.name}</li>
        <li><strong>Cancha:</strong> ${court.name}</li>
        <li><strong>Estado:</strong> ${booking.paymentStatus === 'paid' ? 'PAGADO' : 'PENDIENTE DE PAGO'}</li>
        ${
          booking.paymentStatus !== 'paid'
            ? `<li style="color: #b91c1c;"><strong>⚠️ Tolerancia de pago:</strong> Dispones de <strong>15 minutos</strong> para subir tu comprobante de pago en 'Mis Reservas'. De lo contrario, tu turno se cancelará automáticamente.</li>`
            : ''
        }
        <li><strong>Contacto del club:</strong> ${club.phone || 'Disponible en Mis Reservas'}</li>
      </ul>
    `;
    const detailsClub = `
      <ul style="padding-left: 20px;">
        <li><strong>Referencia:</strong> ${bookingReference}</li>
        <li><strong>Fecha:</strong> ${formattedDate}</li>
        <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
        <li><strong>Club:</strong> ${club.name}</li>
        <li><strong>Cancha:</strong> ${court.name}</li>
        <li><strong>Contacto del usuario:</strong> ${customerInfo?.phone ?? user?.phone ?? 'No especificado'} (${customerInfo?.name || 'Cliente'})</li>
      </ul>
    `;
  
    // Usuario
    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to: customerInfo.email,
      subject: 'Tu reserva ha sido registrada',
      html: this.getEmailTemplate({
        title: '¡Reserva Registrada!',
        greeting: `Hola ${customerInfo.name},`,
        message:
          booking.paymentStatus === 'paid'
            ? 'Tu reserva ha sido confirmada y pagada con éxito.'
            : 'Tu reserva ha sido registrada en estado <strong>PENDIENTE</strong>. Recuerda que dispones de <strong>15 minutos</strong> para adjuntar tu comprobante de pago antes de que sea cancelada.',
        bookingDetailsHtml: detailsUsuario,
      }),
    });
  
    // Club
    if (club?.email) {
      await this.resend.emails.send({
        from: 'TuCancha <noreply@tucancha.com.pe>',
        to: club.email,
        subject: 'Nueva reserva registrada',
        html: this.getEmailTemplate({
          title: 'Nueva reserva registrada',
          greeting: `Hola ${club.name},`,
          message: 'Un usuario ha realizado una reserva en tu club.',
          bookingDetailsHtml: detailsClub,
        }),
      });
    }
  }
  async sendBookingPaidNotifications(booking: Booking) {
    const { customerInfo, club, court, date, startTime, endTime, bookingReference, pricing } = booking;
    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  
    const details = `
      <ul style="padding-left: 20px;">
        <li><strong>Referencia:</strong> ${bookingReference}</li>
        <li><strong>Fecha:</strong> ${formattedDate}</li>
        <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
        <li><strong>Club:</strong> ${club.name}</li>
        <li><strong>Cancha:</strong> ${court.name}</li>
        <li><strong>Total pagado:</strong> S/ ${pricing?.totalPrice}</li>
      </ul>
    `;
  
    // Usuario
    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to: customerInfo.email,
      subject: 'Pago recibido con éxito',
      html: this.getEmailTemplate({
        title: '¡Pago recibido!',
        greeting: `Hola ${customerInfo.name},`,
        message: 'Hemos recibido tu pago y tu cancha ha sido reservada correctamente.',
        bookingDetailsHtml: details,
      }),
    });
  
    // Club
    if (club?.email) {
      await this.resend.emails.send({
        from: 'TuCancha <noreply@tucancha.com.pe>',
        to: club.email,
        subject: 'Nueva reserva pagada',
        html: this.getEmailTemplate({
          title: 'Nueva reserva confirmada',
          greeting: `Hola ${club.name},`,
          message: 'Un usuario ha realizado una reserva pagada en tu club.',
          bookingDetailsHtml: details,
        }),
      });
    }
  }
  

  async sendBookingCancelledEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo, cancellationReason } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: 'Tu reserva fue cancelada',
      greeting: `Hola ${customerInfo.name},`,
      message: 'Lamentamos informarte que tu reserva fue cancelada.',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club.name}</li>
          <li><strong>Cancha:</strong> ${court.name}</li>
        </ul>
        ${cancellationReason ? `<p><strong>Motivo:</strong> ${cancellationReason}</p>` : ''}
      `,
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Tu reserva ha sido cancelada',
      html,
    });
  }

  /**
   * Notificación cuando una reserva expira por falta de comprobante de pago tras 15 minutos
   */
  async sendBookingExpiredUnpaidEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: 'Tu reserva ha expirado por falta de comprobante',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'El tiempo límite de 15 minutos para registrar tu comprobante de pago ha vencido. Tu turno ha sido liberado automáticamente.',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
          <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
        </ul>
        <p style="color: #777; font-size: 13px;">Si deseas jugar en este horario, puedes ingresar nuevamente a la plataforma y realizar una nueva reserva.</p>
      `,
    });

    try {
      if (process.env.RESEND_API_KEY) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject: 'Reserva Expirada - Tiempo límite de pago vencido',
          html,
        });
      }
    } catch (err) {
      console.warn(`⚠️ [MailerService] Error enviando email de expiración a ${to}:`, err?.message || err);
    }
  }

  /**
   * Notificación cuando una reserva con comprobante se auto-confirma para proteger la cancha
   */
  async sendBookingAutoConfirmedPendingAuditEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: '¡Tu reserva ha sido confirmada con éxito!',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'Hemos recibido tu comprobante de pago. Tu cancha está 100% asegurada para tu partido. El club revisará el comprobante en su bandeja de auditoría.',
      bookingDetailsHtml: `
        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="color: #166534; font-weight: bold; margin: 0 0 10px 0;">✓ Cancha Reservada y Asegurada</p>
          <ul style="padding-left: 20px; color: #166534; margin: 0;">
            <li><strong>Referencia:</strong> ${bookingReference}</li>
            <li><strong>Fecha:</strong> ${formattedDate}</li>
            <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
            <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
            <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
          </ul>
        </div>
        <p style="font-size: 13px; color: #555;">¡Nos vemos en la cancha! Presenta tu código de reserva o tu DNI al llegar al club.</p>
      `,
    });

    try {
      if (process.env.RESEND_API_KEY) {
        await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject: '¡Reserva Confirmada! Tu cancha está asegurada',
          html,
        });
      }
    } catch (err) {
      console.warn(`⚠️ [MailerService] Error enviando email de confirmación automática a ${to}:`, err?.message || err);
    }
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${process.env.WEB_SERVICES_URL}/reset-password?token=${token}`;

    const html = this.getEmailTemplate({
      title: 'Restablecer contraseña',
      greeting: 'Hola,',
      message: `Has solicitado restablecer tu contraseña. <br/><br/>
                Haz clic en el siguiente enlace para establecer una nueva:<br/><br/>
                <a href="${resetUrl}" style="color: #16A34A;">Restablecer contraseña</a><br/><br/>
                Este enlace expirará en 15 minutos.`,
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Restablece tu contraseña',
      html,
    });
  }

  async sendClubActivationRequestToAdmin(club: {
    name: string;
    email: string;
    ownerEmail: string;
    phone: string | null;
  }, adminEmail: string = 'tucancha100@gmail.com'
) {
    const html = this.getEmailTemplate({
      title: 'Solicitud de activación de club',
      greeting: 'Hola administrador,',
      message: 'El siguiente club ha solicitado ser activado en TuCancha:',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px;">
          <li><strong>Nombre del club:</strong> ${club.name}</li>
          <li><strong>Email:</strong> ${club.email}</li>
          <li><strong>Teléfono:</strong> ${club?.phone}</li>
        </ul>
      `,
      footerNote: 'Por favor revisa la información y procede con la activación si corresponde.',
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to: adminEmail,
      subject: 'Un club ha solicitado activación en TuCancha',
      html,
    });
  }

  async sendClubRequestConfirmationToOwner(clubEmail: string, clubName: string, adminPhone: string) {
    const html = this.getEmailTemplate({
      title: 'Tu solicitud fue enviada con éxito',
      greeting: `Hola ${clubName},`,
      message: 'Hemos recibido tu solicitud de activación. Nuestro equipo la revisará en breve.',
      bookingDetailsHtml: `
        <p>Si tienes alguna consulta o urgencia, puedes comunicarte con el administrador al siguiente número:</p>
        <p style="font-size: 18px; color: #16A34A;"><strong>${adminPhone}</strong></p>
      `,
      footerNote: 'Gracias por formar parte de TuCancha.',
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to: clubEmail,
      subject: 'Solicitud de activación enviada',
      html,
    });
  }

  async sendMembershipExpiringSoonEmail(
    to: string,
    clubName: string,
    planName: string,
    daysLeft: number,
    endDate: Date,
  ) {
    const formattedDate = new Date(endDate).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: 'Tu membresía vence pronto',
      greeting: `Hola ${clubName},`,
      message: `Te recordamos que tu membresía <strong>${planName}</strong> vencerá en <strong>${daysLeft} días</strong> (el ${formattedDate}).`,
      bookingDetailsHtml: `
        <p>Para evitar interrupciones en la visibilidad de tus canchas y en la recepción de reservas online, por favor renueva tu plan a tiempo desde el panel del club.</p>
        <p style="margin-top: 15px;">
          <a href="${process.env.WEB_SERVICES_URL}/club/membership" style="background-color: #16A34A; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Renovar Membresía
          </a>
        </p>
      `,
      footerNote: 'Si ya renovaste, por favor desestima este mensaje.',
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: `Tu membresía en TuCancha vence en ${daysLeft} días`,
      html,
    });
  }

  async sendMembershipEnteredGraceEmail(to: string, clubName: string, graceEndDate: Date) {
    const formattedDate = new Date(graceEndDate).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = this.getEmailTemplate({
      title: 'Tu membresía ha entrado en Periodo de Gracia',
      greeting: `Hola ${clubName},`,
      message: `Tu membresía ha vencido, pero te hemos otorgado un <strong>periodo de gracia hasta el ${formattedDate}</strong> para que puedas renovarla sin perder visibilidad.`,
      bookingDetailsHtml: `
        <p style="color: #d97706; font-weight: bold;">
          ⚠️ Si no renuevas antes del ${formattedDate}, tus canchas quedarán ocultas en el buscador público y no podrás recibir nuevas reservas.
        </p>
        <p style="margin-top: 15px;">
          <a href="${process.env.WEB_SERVICES_URL}/club/membership" style="background-color: #d97706; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Pagar y Renovar Ahora
          </a>
        </p>
      `,
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: '⚠️ Tu membresía está en periodo de gracia - TuCancha',
      html,
    });
  }

  async sendMembershipExpiredEmail(to: string, clubName: string) {
    const html = this.getEmailTemplate({
      title: 'Membresía Expirada - Canchas Ocultas',
      greeting: `Hola ${clubName},`,
      message: `Tu membresía en TuCancha ha expirado y el periodo de gracia ha finalizado.`,
      bookingDetailsHtml: `
        <p style="color: #dc2626; font-weight: bold;">
          Tus canchas han sido ocultadas del catálogo público y no aparecerán en las búsquedas hasta que actives un nuevo plan.
        </p>
        <p style="margin-top: 15px;">
          <a href="${process.env.WEB_SERVICES_URL}/club/membership" style="background-color: #16A34A; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reactivar mis Canchas
          </a>
        </p>
      `,
      footerNote: 'Puedes reactivar tu cuenta en cualquier momento renovando tu membresía.',
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Tu membresía ha expirado - Canchas pausadas',
      html,
    });
  }

  async sendTrialExpiredEmail(to: string, clubName: string) {
    const html = this.getEmailTemplate({
      title: 'Prueba Gratuita Expirada - Canchas Suspendidas',
      greeting: `Hola ${clubName},`,
      message: `Tu periodo de prueba gratuita de 30 días en TuCancha ha finalizado.`,
      bookingDetailsHtml: `
        <p style="color: #dc2626; font-weight: bold;">
          Tu acceso al panel y la visibilidad de tus canchas han sido suspendidos temporalmente. Para reactivar tu cuenta y continuar recibiendo reservas, por favor suscríbete a uno de nuestros planes.
        </p>
        <p style="margin-top: 15px;">
          <a href="${process.env.WEB_SERVICES_URL}/club/membership" style="background-color: #16A34A; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Suscribirse Ahora
          </a>
        </p>
      `,
      footerNote: 'Puedes cancelar o renovar tu membresía en cualquier momento desde tu panel de usuario.',
    });

    await this.resend.emails.send({
      from: 'TuCancha <noreply@tucancha.com.pe>',
      to,
      subject: 'Tu prueba gratuita en TuCancha ha vencido - Acceso suspendido',
      html,
    });
  }
}
