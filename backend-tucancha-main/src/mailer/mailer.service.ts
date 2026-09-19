import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { Booking } from '../booking/booking.entity';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private resend: Resend;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');
    this.initTransporter();
  }

  private initTransporter() {
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.MAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.MAIL_PASS;

    if (smtpUser && smtpPass) {
      const isGmail = smtpUser.includes('@gmail.com') || (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('gmail'));
      this.transporter = nodemailer.createTransport(
        isGmail
          ? {
              service: 'gmail',
              auth: {
                user: smtpUser,
                pass: smtpPass.replace(/\s+/g, ''),
              },
            }
          : {
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: Number(process.env.SMTP_PORT) || 465,
              secure: process.env.SMTP_SECURE === 'true' || (!process.env.SMTP_PORT || process.env.SMTP_PORT === '465'),
              auth: {
                user: smtpUser,
                pass: smtpPass,
              },
            },
      );
      this.logger.log(`📧 [MailerService] Servidor SMTP configurado para: ${smtpUser}`);
    }
  }

  private get fromEmail(): string {
    return process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || 'TuCancha <notificaciones@tucancha.com.pe>';
  }

  private get webUrl(): string {
    return process.env.WEB_SERVICES_URL || 'http://localhost:3000';
  }

  /**
   * Helper para obtener el correo de destino del Club de manera confiable
   */
  public getClubTargetEmail(booking: Booking): string | null {
    if (!booking) return null;
    return (
      booking.club?.email ||
      (booking.club as any)?.owner?.email ||
      booking.court?.club?.email ||
      (booking.court?.club as any)?.owner?.email ||
      null
    );
  }

  /**
   * Helper para obtener el correo del usuario/jugador
   */
  public getUserTargetEmail(booking: Booking): string | null {
    if (!booking) return null;
    return booking.customerInfo?.email || booking.user?.email || null;
  }

  private getEmailTemplate({
    title,
    greeting,
    message,
    bookingDetailsHtml,
    footerNote,
    actionButton,
  }: {
    title: string;
    greeting: string;
    message: string;
    bookingDetailsHtml?: string;
    footerNote?: string;
    actionButton?: { text: string; url: string; color?: string };
  }): string {
    const buttonHtml = actionButton
      ? `
        <div style="text-align: center; margin: 30px 0 20px 0;">
          <a href="${actionButton.url}" style="background-color: ${actionButton.color || '#16A34A'}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${actionButton.text}
          </a>
        </div>
      `
      : '';

    return `
      <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <!-- Header con gradiente deportivo -->
        <div style="background: linear-gradient(135deg, #15803d 0%, #16a34a 50%, #22c55e 100%); padding: 28px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">⚽ TuCancha</h1>
          <p style="color: #dcfce7; margin: 4px 0 0 0; font-size: 13px; font-weight: 500;">La plataforma líder de reservas deportivas</p>
        </div>

        <!-- Contenido principal -->
        <div style="padding: 30px 24px; color: #1f2937; line-height: 1.6;">
          <h2 style="color: #166534; margin-top: 0; font-size: 20px; font-weight: 700; border-bottom: 2px solid #f0fdf4; padding-bottom: 12px;">${title}</h2>
          <p style="font-size: 16px; margin: 16px 0 8px 0;"><strong>${greeting}</strong></p>
          <div style="font-size: 14px; color: #374151; margin-bottom: 20px;">
            ${message}
          </div>

          ${bookingDetailsHtml || ''}
          ${buttonHtml}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #6b7280; text-align: center;">
            <p style="margin: 0 0 6px 0;">
              ${footerNote || '¿Tienes dudas o necesitas asistencia? Contáctanos a través de nuestros canales oficiales.'}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 16px 20px; text-align: center; font-size: 11px; color: #9ca3af;">
          © ${new Date().getFullYear()} TuCancha. Todos los derechos reservados.<br/>
          Este es un correo transaccional generado automáticamente por la plataforma.
        </div>
      </div>
    `;
  }

  public async sendEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!to || !to.includes('@')) {
      this.logger.warn(`⚠️ [MailerService] Dirección de correo inválida o no proporcionada: "${to}"`);
      return { success: false, error: 'Email inválido o ausente' };
    }

    // 1. Intentar primero con SMTP / Gmail si está configurado (no tiene restricción de dominio)
    if (this.transporter) {
      try {
        const smtpFrom = process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.MAIL_USER || this.fromEmail;
        const fromHeader = smtpFrom.includes('<') ? smtpFrom : `TuCancha <${smtpFrom}>`;
        const info = await this.transporter.sendMail({
          from: fromHeader,
          to,
          subject,
          html,
        });
        this.logger.log(`📧 [MailerService] (SMTP/Gmail) Correo enviado exitosamente a "${to}" [${subject}] (ID: ${info.messageId})`);
        return { success: true };
      } catch (smtpErr: any) {
        this.logger.error(`❌ [MailerService] Error enviando vía SMTP a "${to}": ${smtpErr?.message}`);
        // Si falla SMTP, continuará intentando con Resend abajo
      }
    }

    // 2. Intentar con Resend
    try {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_dummy') {
        const { data, error } = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });

        if (error) {
          this.logger.error(
            `❌ [MailerService] Error de entrega Resend a "${to}" [${subject}]: ${JSON.stringify(error)}`,
          );
          if (
            error.message?.includes('testing emails to your own email address') ||
            error.message?.includes('validation_error') ||
            (error as any).statusCode === 403
          ) {
            this.logger.warn(
              `💡 [MailerService] AVISO IMPORTANTE: Tu clave de Resend está en modo prueba ('onboarding@resend.dev') y Resend NO permite enviar a "${to}" hasta que verifiques un dominio en https://resend.com/domains. Para enviar correos a cualquier persona sin comprar dominio, puedes configurar en tu archivo .env las variables GMAIL_USER y GMAIL_APP_PASSWORD (o SMTP_USER y SMTP_PASS).`,
            );
          }
          return { success: false, error: error.message };
        }

        this.logger.log(`📧 [MailerService] (Resend) Correo enviado exitosamente a "${to}" [${subject}] (ID: ${data?.id})`);
        return { success: true };
      } else {
        this.logger.warn(`⚠️ [MailerService] Ni SMTP ni RESEND_API_KEY configuradas. No se pudo enviar correo a: ${to}`);
        return { success: false, error: 'Servicio de correo no configurado' };
      }
    } catch (err: any) {
      this.logger.error(`❌ [MailerService] Excepción al enviar correo a "${to}": ${err?.message || err}`);
      return { success: false, error: err?.message || 'Error desconocido' };
    }
  }

  /**
   * 1. Correo de bienvenida para la creación de cuenta de nuevos usuarios (jugadores)
   */
  async sendUserWelcomeEmail(to: string, userName: string, token?: string) {
    const confirmationUrl = token
      ? `${process.env.SERVICES_URL || 'http://localhost:3001'}/auth/confirm?token=${token}`
      : null;

    const actionUrl = confirmationUrl || `${this.webUrl}/search`;
    const actionText = confirmationUrl ? 'Confirmar mi Cuenta y Comenzar' : 'Explorar Canchas y Reservar';

    const message = `
      ¡Te damos la bienvenida a <strong>TuCancha</strong>! Tu cuenta ha sido creada exitosamente.<br/><br/>
      Ahora puedes buscar tus canchas favoritas de fútbol, pádel y más en tiempo real, reservar en segundos y jugar con tus amigos con total comodidad.
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">✨ Con TuCancha podrás:</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.8;">
          <li>Buscar y comparar canchas por distrito, deporte y tipo de superficie.</li>
          <li>Reservar horarios al instante y asegurar tu partido.</li>
          <li>Pagar con Yape, Plin o Mercado Pago de forma 100% segura.</li>
          <li>Acceder al historial de tus reservas en 'Mis Reservas'.</li>
        </ul>
      </div>
      ${confirmationUrl ? 'Por favor confirma tu cuenta haciendo clic en el siguiente botón:' : ''}
    `;

    const html = this.getEmailTemplate({
      title: '¡Bienvenido a TuCancha!',
      greeting: `Hola ${userName || 'Deportista'},`,
      message,
      actionButton: {
        text: actionText,
        url: actionUrl,
        color: '#16A34A',
      },
      footerNote: '¡Nos vemos en la cancha! Si no creaste esta cuenta, puedes ignorar este correo.',
    });

    return this.sendEmail({
      to,
      subject: '⚽ ¡Bienvenido a TuCancha! Tu cuenta ha sido creada con éxito',
      html,
    });
  }

  /**
   * 2. Correo al registrarse un Club: Notifica al dueño que la cuenta está en espera de confirmación administrativa
   */
  async sendClubRegisteredPendingApprovalEmail(
    to: string,
    club: { name: string; email: string; phone?: string; address?: string },
    ownerName?: string,
  ) {
    const html = this.getEmailTemplate({
      title: 'Cuenta de Club Registrada - En Revisión',
      greeting: `Hola ${ownerName || club.name},`,
      message: `
        Tu cuenta de club para <strong>${club.name}</strong> ha sido creada correctamente en TuCancha.<br/><br/>
        En este momento tu solicitud se encuentra <strong>esperando la confirmación del administrador</strong>. Nuestro equipo validará los datos de tu club para garantizar la seguridad de la comunidad deportiva.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #b45309; font-size: 14px;">⏳ Estado del Registro:</h4>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #92400e;">
            <strong>Estado actual:</strong> <span style="background-color: #fef08a; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #854d0e;">PENDIENTE DE REVISIÓN</span>
          </p>
          <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">
            Una vez que el administrador acepte tu club, recibirás una notificación de confirmación con <strong>30 días de prueba gratis</strong> para que puedas configurar tus canchas, horarios, precios y comenzar a recibir reservas inmediatamente.
          </p>
        </div>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 15px 0; font-size: 13px;">
          <strong style="color: #374151;">Datos del Club Registrado:</strong>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
            <li><strong>Club:</strong> ${club.name}</li>
            <li><strong>Email de contacto:</strong> ${club.email}</li>
            ${club.phone ? `<li><strong>Teléfono:</strong> ${club.phone}</li>` : ''}
            ${club.address ? `<li><strong>Dirección:</strong> ${club.address}</li>` : ''}
          </ul>
        </div>
      `,
      footerNote: 'El proceso de revisión suele demorar pocas horas. Si tienes dudas o necesitas activación urgente, contáctanos a soporte@tucancha.com.pe.',
    });

    return this.sendEmail({
      to,
      subject: `🏢 Solicitud de Club Registrada - Esperando confirmación del administrador | TuCancha`,
      html,
    });
  }

  /**
   * 3. Correo a la cuenta del Administrador de TuCancha cuando un nuevo club se registra y requiere aceptación
   */
  async sendNewClubAdminNotificationEmail(
    adminEmail: string = process.env.ADMIN_EMAIL || 'tucancha100@gmail.com',
    club: { name: string; email: string; phone?: string; address?: string; district?: string; createdAt?: Date },
    owner: { name?: string; email?: string; phone?: string },
  ) {
    const formattedDate = new Date(club.createdAt || new Date()).toLocaleString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const adminPanelUrl = `${this.webUrl}/admin/clubs`;

    const html = this.getEmailTemplate({
      title: '🚨 Nueva Solicitud de Registro de Club',
      greeting: 'Hola Administrador de TuCancha,',
      message: `
        Se ha registrado un nuevo club deportivo en la plataforma y se encuentra <strong>pendiente de aprobación</strong> para comenzar a operar.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0; font-size: 14px;">
          <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px;">📋 Ficha del Club:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b; width: 140px;"><strong>Nombre del Club:</strong></td>
              <td style="color: #0f172a; font-weight: bold;">${club.name}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Email del Club:</strong></td>
              <td style="color: #0f172a;">${club.email}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Teléfono / WhatsApp:</strong></td>
              <td style="color: #0f172a;">${club.phone || 'No especificado'}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Dirección / Distrito:</strong></td>
              <td style="color: #0f172a;">${club.address || ''} ${club.district ? `(${club.district})` : ''}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Titular / Dueño:</strong></td>
              <td style="color: #0f172a;">${owner?.name || 'No especificado'} (${owner?.email || club.email})</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Fecha de Registro:</strong></td>
              <td style="color: #0f172a;">${formattedDate}</td>
            </tr>
          </table>
        </div>
      `,
      actionButton: {
        text: 'Revisar y Aprobar en Panel Admin',
        url: adminPanelUrl,
        color: '#0284C7',
      },
      footerNote: 'Por favor revisa que la información del club sea fidedigna antes de proceder con la activación.',
    });

    return this.sendEmail({
      to: adminEmail,
      subject: `🚨 [TuCancha Admin] Nueva solicitud de club por aprobar: ${club.name}`,
      html,
    });
  }

  /**
   * 4. Correo al dueño del club cuando el administrador lo aprueba:
   * "Has sido aceptado por el administrador y accedido a los 30 dias de prueba gratis"
   */
  async sendClubApprovedWithTrialEmail(
    to: string,
    clubName: string,
    trialEndDate: Date,
    ownerName?: string,
  ) {
    const formattedTrialEnd = new Date(trialEndDate).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const clubDashboardUrl = `${this.webUrl}/club/dashboard`;

    const html = this.getEmailTemplate({
      title: '🎉 ¡Felicidades! Tu club ha sido aceptado',
      greeting: `¡Hola ${ownerName || clubName}!`,
      message: `
        Nos alegra darte la bienvenida a nuestra red oficial de clubes deportivos.<br/><br/>
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="color: #166534; font-size: 18px; font-weight: 800; margin: 0 0 8px 0;">
            🌟 ¡Has sido aceptado por el administrador y has accedido a los 30 días de prueba gratis!
          </p>
          <p style="color: #15803d; font-size: 14px; margin: 0;">
            Tu periodo de prueba completo está activo hasta el <strong>${formattedTrialEnd}</strong> sin costo alguno.
          </p>
        </div>
        Ya puedes ingresar a tu panel de administración para comenzar a rentabilizar y gestionar tus canchas.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px;">🚀 Próximos pasos para empezar a recibir reservas:</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.8;">
            <li><strong>Registra tus canchas:</strong> Define el tipo de deporte (Fútbol, Pádel, etc.), características y fotos.</li>
            <li><strong>Configura horarios y tarifas:</strong> Establece tus precios diurnos, nocturnos y promociones.</li>
            <li><strong>Configura tus medios de cobro:</strong> Activa pagos con Yape, Plin o Mercado Pago.</li>
            <li><strong>Publica tu club:</strong> Tus canchas aparecerán automáticamente en el buscador para miles de jugadores.</li>
          </ol>
        </div>
      `,
      actionButton: {
        text: 'Ingresar a mi Panel de Club',
        url: clubDashboardUrl,
        color: '#16A34A',
      },
      footerNote: '¡Te deseamos el mayor de los éxitos! Si necesitas ayuda con la configuración, nuestro equipo de soporte está listo para asistirte.',
    });

    return this.sendEmail({
      to,
      subject: `🎉 ¡Aceptado por el administrador! Disfruta de tus 30 días de prueba gratis - TuCancha`,
      html,
    });
  }

  /**
   * 5. Notificación al CLUB cuando un usuario sube un comprobante de pago para auditoría (Yape, Plin, Transferencia)
   */
  async sendPaymentReceiptUploadedClubNotificationEmail(booking: Booking, payment: any) {
    const clubEmail = this.getClubTargetEmail(booking);
    if (!clubEmail) {
      this.logger.warn(`⚠️ [Mailer] No se pudo encontrar email del club para la reserva ${booking.bookingReference || booking.id}`);
      return;
    }

    const { date, startTime, endTime, court, club, bookingReference, customerInfo, user } = booking;
    const clientName = customerInfo?.name || user?.name || 'Cliente';
    const clientPhone = customerInfo?.phone || user?.phone || 'No especificado';
    const clientEmail = customerInfo?.email || user?.email || 'No especificado';

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const isSaldo =
      payment?.type === 'SALDO' ||
      Boolean(payment?.saldoComprobanteUrl && (payment?.status === 'PAID' || payment?.saldoAmount > 0));
    const amount = isSaldo ? (payment?.saldoAmount ?? payment?.amount) : (payment?.amount ?? booking.pricing?.totalPrice ?? '0.00');
    const method = (isSaldo ? payment?.saldoMethod : null) || payment?.method || payment?.paymentMethod || booking.paymentMethod || 'Yape / Plin';
    const clubBookingsUrl = `${this.webUrl}/club/bookings`;

    const html = this.getEmailTemplate({
      title: isSaldo
        ? '🔔 Comprobante de 2do Pago (Saldo) - Auditoría Requerida'
        : '🔔 Comprobante de Pago Subido - Auditoría Requerida',
      greeting: `Hola ${club?.name || 'Administrador del Club'},`,
      message: isSaldo
        ? `
        Un cliente ha adjuntado el comprobante de liquidación del <strong>saldo restante (2do abono)</strong> y se encuentra esperando tu validación en el panel de club para completar la liquidación.
      `
        : `
        Un cliente ha adjuntado su comprobante de pago y se encuentra <strong>esperando tu auditoría y validación</strong> para confirmar su reserva de cancha.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin: 18px 0;">
          <h3 style="margin-top: 0; color: #1e40af; font-size: 16px; margin-bottom: 12px;">📋 Datos de la Reserva y Pago</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.8;">
            <tr>
              <td style="color: #64748b; width: 140px;"><strong>Cancha:</strong></td>
              <td style="color: #1e293b; font-weight: bold;">${court?.name || 'Cancha'}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Fecha y Hora:</strong></td>
              <td style="color: #1e293b;">${formattedDate} | <span style="font-weight: bold; color: #16a34a;">${startTime} - ${endTime}</span></td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Monto Reportado:</strong></td>
              <td style="color: #1e293b; font-weight: bold; font-size: 14px;">S/ ${amount} (${method}) ${isSaldo ? '(Saldo Restante)' : ''}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Código de Reserva:</strong></td>
              <td style="color: #0f172a; font-family: monospace; font-weight: bold;">${bookingReference}</td>
            </tr>
            <tr>
              <td style="color: #64748b;"><strong>Cliente:</strong></td>
              <td style="color: #1e293b;">${clientName} (${clientPhone} - ${clientEmail})</td>
            </tr>
          </table>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 13px; color: #92400e;">
          ⚡ <strong>Acción requerida:</strong> Ingresa a tu panel de club en la sección de Reservas para revisar el comprobante fotográfico y dar clic en <strong>Confirmar Pago</strong> o <strong>Rechazar</strong>.
        </div>
      `,
      actionButton: {
        text: 'Auditar Comprobante en Panel de Club',
        url: clubBookingsUrl,
        color: '#2563EB',
      },
      footerNote: 'Recuerda auditar los comprobantes oportunamente para garantizar una excelente experiencia al usuario.',
    });

    return this.sendEmail({
      to: clubEmail,
      subject: isSaldo
        ? `🔔 [Auditoría de Saldo] Comprobante de 2do pago subido para reserva #${bookingReference} - ${court?.name || 'TuCancha'}`
        : `🔔 [Auditoría de Pago] Comprobante subido para reserva #${bookingReference} - ${court?.name || 'TuCancha'}`,
      html,
    });
  }

  /**
   * 6. Notificación al USUARIO cuando sube su comprobante y está en espera de auditoría
   */
  async sendPaymentReceiptUploadedUserNotificationEmail(booking: Booking, payment: any) {
    const userEmail = this.getUserTargetEmail(booking);
    if (!userEmail) return;

    const { date, startTime, endTime, court, club, bookingReference, customerInfo, user } = booking;
    const clientName = customerInfo?.name || user?.name || 'Cliente';

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const isSaldo =
      payment?.type === 'SALDO' ||
      Boolean(payment?.saldoComprobanteUrl && (payment?.status === 'PAID' || payment?.saldoAmount > 0));
    const amount = isSaldo ? (payment?.saldoAmount ?? payment?.amount) : (payment?.amount ?? booking.pricing?.totalPrice ?? '0.00');
    const myBookingsUrl = `${this.webUrl}/user/bookings`;

    const html = this.getEmailTemplate({
      title: isSaldo
        ? '⏳ Comprobante de Saldo Recibido - En Auditoría'
        : '⏳ Comprobante Recibido - En Auditoría',
      greeting: `Hola ${clientName},`,
      message: isSaldo
        ? `
        Hemos recibido tu comprobante de saldo restante con éxito. En este momento el <strong>club está verificando tu segundo abono</strong> para completar la liquidación de tu reserva.
      `
        : `
        Hemos recibido tu comprobante de pago con éxito. En este momento el <strong>club está auditando tu pago</strong> para confirmar definitivamente tu reserva.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 18px 0;">
          <h3 style="margin-top: 0; color: #166534; font-size: 16px; margin-bottom: 12px;">⚽ Resumen de tu Reserva</h3>
          <ul style="padding-left: 20px; line-height: 1.8; color: #1f2937; margin: 0; font-size: 14px;">
            <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
            <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
            <li><strong>Fecha:</strong> ${formattedDate}</li>
            <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
            <li><strong>Monto a verificar:</strong> S/ ${amount} ${isSaldo ? '(Saldo Restante)' : ''}</li>
            <li><strong>Código de Reserva:</strong> <span style="font-family: monospace; font-weight: bold;">${bookingReference}</span></li>
          </ul>
        </div>
        <p style="font-size: 13px; color: #4b5563;">
          Te notificaremos por correo apenas el club verifique tu transferencia/Yape. También puedes ver el estado en tiempo real desde la sección 'Mis Reservas'.
        </p>
      `,
      actionButton: {
        text: 'Ver Mis Reservas',
        url: myBookingsUrl,
        color: '#16A34A',
      },
      footerNote: '¡Gracias por usar TuCancha! Ante cualquier duda puedes contactar directamente al club.',
    });

    return this.sendEmail({
      to: userEmail,
      subject: `⏳ Comprobante recibido - Reserva #${bookingReference} en revisión - TuCancha`,
      html,
    });
  }

  /**
   * 7. Correo recordatorio 30 minutos antes del turno programado con reserva confirmada y pagada
   */
  async sendBookingReminderEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const clubAddress = (court as any)?.venue?.address || club?.address || '';
    const clubPhone = club?.whatsapp || club?.phone || '';
    const bookingsUrl = `${this.webUrl}/user/bookings`;

    const html = this.getEmailTemplate({
      title: '⏰ ¡Tu partido comienza en 30 minutos!',
      greeting: `Hola ${customerInfo?.name || 'Deportista'},`,
      message: `
        Te recordamos que tienes una reserva de cancha confirmada para hoy en unos minutos. ¡Ve alistando tu indumentaria deportiva!
      `,
      bookingDetailsHtml: `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 18px 0;">
          <h3 style="margin-top: 0; color: #166534; font-size: 16px; margin-bottom: 12px;">⚽ Resumen de tu Turno</h3>
          <ul style="padding-left: 20px; line-height: 1.8; color: #1f2937; margin: 0; font-size: 14px;">
            <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
            <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
            <li><strong>Fecha:</strong> ${formattedDate}</li>
            <li><strong>Horario:</strong> <span style="font-size: 15px; font-weight: bold; color: #16a34a;">${startTime} - ${endTime}</span></li>
            <li><strong>Código de Reserva:</strong> <span style="font-family: monospace; font-weight: bold;">${bookingReference}</span></li>
            ${clubAddress ? `<li><strong>Dirección:</strong> ${clubAddress}</li>` : ''}
          </ul>
        </div>

        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
            💡 <strong>Consejos útiles:</strong><br/>
            • Te recomendamos llegar <strong>10 a 15 minutos antes</strong> para hacer el calentamiento previo y confirmar tu ingreso.<br/>
            • Lleva calzado adecuado para el tipo de superficie y ropa cómoda.<br/>
            • Presenta tu código de reserva o DNI al encargado del club al llegar.
          </p>
        </div>

        ${
          clubPhone
            ? `<div style="text-align: center; margin-bottom: 15px;">
                <a href="https://wa.me/${clubPhone.replace(/\D/g, '')}?text=Hola,%20tengo%20la%20reserva%20${bookingReference}%20hoy%20a%20las%20${startTime}" style="color: #059669; font-size: 13px; text-decoration: underline; font-weight: 500;">
                  💬 Contactar al Club por WhatsApp (${clubPhone})
                </a>
              </div>`
            : ''
        }
      `,
      actionButton: {
        text: 'Ver Mi Reserva en TuCancha',
        url: bookingsUrl,
        color: '#16A34A',
      },
      footerNote: '¡Que tengas un excelente partido! Si tienes algún inconveniente, comunícate directamente con el club.',
    });

    return this.sendEmail({
      to,
      subject: `⏰ ¡Tu partido comienza en 30 min! ${startTime} - ${court?.name || 'TuCancha'}`,
      html,
    });
  }

  /**
   * 8. Correo al usuario que no subió su comprobante dentro del límite y su reserva fue liberada
   */
  async sendBookingExpiredUnpaidEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const searchUrl = `${this.webUrl}/search`;

    const html = this.getEmailTemplate({
      title: 'Reserva de Cancha Liberada',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: `
        Te informamos que tu reserva de cancha ha sido <strong>liberada automáticamente</strong> debido a que no se completó el proceso de pago o registro dentro del tiempo de espera.
      `,
      bookingDetailsHtml: `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
          <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">⚠️ Detalles de la Reserva Liberada:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; line-height: 1.8;">
            <li><strong>Código de Referencia:</strong> ${bookingReference}</li>
            <li><strong>Fecha:</strong> ${formattedDate}</li>
            <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
            <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
            <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
          </ul>
        </div>
        <p style="color: #4b5563; font-size: 14px; margin: 15px 0;">
          El horario reservado ha sido desbloqueado y queda disponible para toda la comunidad. Si aún deseas jugar en este turno u otro horario, puedes ingresar nuevamente y realizar una nueva reserva.
        </p>
      `,
      actionButton: {
        text: 'Buscar y Reservar Cancha',
        url: searchUrl,
        color: '#16A34A',
      },
      footerNote: 'Para garantizar la reserva de tu cancha en futuros partidos, asegúrate de adjuntar tu comprobante oportunamente.',
    });

    return this.sendEmail({
      to,
      subject: `⚠️ Tu reserva de cancha ha sido liberada - TuCancha`,
      html,
    });
  }

  async sendConfirmationEmail(to: string, token: string) {
    const confirmationUrl = `${process.env.SERVICES_URL || 'http://localhost:3001'}/auth/confirm?token=${token}`;

    const html = this.getEmailTemplate({
      title: 'Confirma tu cuenta',
      greeting: '¡Bienvenido a TuCancha!',
      message: `Haz clic en el siguiente enlace o botón para confirmar tu cuenta:<br/><br/>
                <a href="${confirmationUrl}" style="color: #16A34A; font-weight: bold;">Confirmar mi cuenta ahora</a>`,
      actionButton: {
        text: 'Confirmar Cuenta',
        url: confirmationUrl,
        color: '#16A34A',
      },
    });

    return this.sendEmail({
      to,
      subject: 'Confirma tu cuenta en TuCancha',
      html,
    });
  }

  async sendBookingConfirmationEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, pricing, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const html = this.getEmailTemplate({
      title: '¡Tu reserva fue registrada!',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'Tu reserva ha sido registrada en el sistema. Aquí los detalles:',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px; line-height: 1.8;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club?.name}</li>
          <li><strong>Cancha:</strong> ${court?.name}</li>
          <li><strong>Total:</strong> S/ ${pricing?.totalPrice ?? '0.00'}</li>
        </ul>
      `,
    });

    return this.sendEmail({
      to,
      subject: 'Tu reserva ha sido registrada - TuCancha',
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
      timeZone: 'UTC',
    });

    const html = this.getEmailTemplate({
      title: '¡Pago recibido con éxito!',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'Hemos validado y confirmado tu pago. ¡Tu cancha está 100% asegurada para tu partido!',
      bookingDetailsHtml: `
        <ul style="padding-left: 20px; line-height: 1.8;">
          <li><strong>Referencia:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club?.name}</li>
          <li><strong>Cancha:</strong> ${court?.name}</li>
          <li><strong>Total pagado:</strong> S/ ${pricing?.totalPrice ?? '0.00'}</li>
        </ul>
      `,
    });

    return this.sendEmail({
      to,
      subject: '¡Tu pago fue recibido con éxito! Reserva confirmada - TuCancha',
      html,
    });
  }

  /**
   * Envía notificaciones de registro de reserva al Usuario y al Club
   */
  async sendBookingReservationNotifications(booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo, user } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const isPaid = booking.paymentStatus === 'paid';
    const userEmail = this.getUserTargetEmail(booking);
    const clubEmail = this.getClubTargetEmail(booking);

    const detailsUsuario = `
      <ul style="padding-left: 20px; line-height: 1.8;">
        <li><strong>Referencia:</strong> ${bookingReference}</li>
        <li><strong>Fecha:</strong> ${formattedDate}</li>
        <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
        <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
        <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
        <li><strong>Estado:</strong> <span style="font-weight: bold; color: ${isPaid ? '#16a34a' : '#d97706'}">${isPaid ? 'PAGADO Y CONFIRMADO' : 'PENDIENTE DE PAGO'}</span></li>
        ${
          !isPaid
            ? `<li style="color: #b91c1c;"><strong>⚠️ Pasos siguientes:</strong> Adjunta tu comprobante de pago en 'Mis Reservas' para que el club confirme tu turno.</li>`
            : ''
        }
        <li><strong>Contacto del club:</strong> ${club?.phone || 'Disponible en Mis Reservas'}</li>
      </ul>
    `;

    const detailsClub = `
      <ul style="padding-left: 20px; line-height: 1.8;">
        <li><strong>Referencia:</strong> ${bookingReference}</li>
        <li><strong>Fecha:</strong> ${formattedDate}</li>
        <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
        <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
        <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
        <li><strong>Estado:</strong> ${isPaid ? 'PAGADO' : 'PENDIENTE'}</li>
        <li><strong>Contacto del usuario:</strong> ${customerInfo?.phone ?? user?.phone ?? 'No especificado'} (${customerInfo?.name || user?.name || 'Cliente'})</li>
      </ul>
    `;

    // 1. Enviar a Usuario
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: isPaid
          ? `⚽ Reserva confirmada y pagada - #${bookingReference} | TuCancha`
          : `⚽ Reserva registrada #${bookingReference} - Pendiente de comprobante | TuCancha`,
        html: this.getEmailTemplate({
          title: isPaid ? '¡Reserva Confirmada!' : '¡Reserva Registrada!',
          greeting: `Hola ${customerInfo?.name || user?.name || 'Cliente'},`,
          message: isPaid
            ? 'Tu reserva ha sido confirmada y pagada con éxito.'
            : 'Tu reserva ha sido registrada en estado <strong>PENDIENTE</strong>. Recuerda adjuntar tu comprobante de pago en el apartado "Mis Reservas" para que el club audite y asegure tu turno.',
          bookingDetailsHtml: detailsUsuario,
          actionButton: {
            text: 'Ver Mis Reservas',
            url: `${this.webUrl}/user/bookings`,
            color: '#16A34A',
          },
        }),
      });
    }

    // 2. Enviar a Club
    if (clubEmail) {
      await this.sendEmail({
        to: clubEmail,
        subject: `🏟️ Nueva reserva registrada: #${bookingReference} (${court?.name || 'Cancha'}) - TuCancha`,
        html: this.getEmailTemplate({
          title: 'Nueva Reserva en tu Club',
          greeting: `Hola ${club?.name || 'Club'},`,
          message: `Se ha registrado una nueva reserva para la cancha <strong>${court?.name || 'Cancha'}</strong>.`,
          bookingDetailsHtml: detailsClub,
          actionButton: {
            text: 'Ver en Panel de Reservas',
            url: `${this.webUrl}/club/bookings`,
            color: '#2563EB',
          },
        }),
      });
    }
  }

  /**
   * Envía notificaciones de pago confirmado al Usuario y al Club
   */
  async sendBookingPaidNotifications(booking: Booking) {
    const { customerInfo, club, court, date, startTime, endTime, bookingReference, pricing, user } = booking;
    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const userEmail = this.getUserTargetEmail(booking);
    const clubEmail = this.getClubTargetEmail(booking);

    const details = `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 18px 0;">
        <ul style="padding-left: 20px; line-height: 1.8; color: #166534; margin: 0; font-size: 14px;">
          <li><strong>Código de Reserva:</strong> ${bookingReference}</li>
          <li><strong>Fecha:</strong> ${formattedDate}</li>
          <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
          <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
          <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
          <li><strong>Total pagado:</strong> S/ ${pricing?.totalPrice ?? '0.00'}</li>
        </ul>
      </div>
    `;

    // 1. Usuario
    if (userEmail) {
      await this.sendEmail({
        to: userEmail,
        subject: `✅ ¡Pago Confirmado! Reserva #${bookingReference} asegurada - TuCancha`,
        html: this.getEmailTemplate({
          title: '¡Pago Confirmado y Turno Asegurado!',
          greeting: `Hola ${customerInfo?.name || user?.name || 'Cliente'},`,
          message: 'Tu pago ha sido validado y confirmado. Tu cancha está 100% asegurada para tu partido.',
          bookingDetailsHtml: details,
          actionButton: {
            text: 'Ver Mi Reserva',
            url: `${this.webUrl}/user/bookings`,
            color: '#16A34A',
          },
        }),
      });
    }

    // 2. Club
    if (clubEmail) {
      await this.sendEmail({
        to: clubEmail,
        subject: `💰 Reserva Pagada y Confirmada: #${bookingReference} (${court?.name || 'Cancha'}) - TuCancha`,
        html: this.getEmailTemplate({
          title: 'Reserva Pagada y Confirmada',
          greeting: `Hola ${club?.name || 'Club'},`,
          message: `El pago de la reserva <strong>#${bookingReference}</strong> ha sido confirmado exitosamente.`,
          bookingDetailsHtml: details,
          actionButton: {
            text: 'Ver Panel de Reservas',
            url: `${this.webUrl}/club/bookings`,
            color: '#16A34A',
          },
        }),
      });
    }
  }

  async sendBookingCancelledEmail(to: string, booking: Booking, reason?: string) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo, cancellationReason } = booking;
    const effectiveReason = reason || cancellationReason || 'Cancelado por el club / administrador';

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const html = this.getEmailTemplate({
      title: 'Tu reserva fue cancelada',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'Lamentamos informarte que tu reserva no ha sido completada o fue rechazada.',
      bookingDetailsHtml: `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 13px;">
          <ul style="padding-left: 20px; line-height: 1.8; color: #7f1d1d; margin: 0;">
            <li><strong>Código de Reserva:</strong> ${bookingReference}</li>
            <li><strong>Fecha:</strong> ${formattedDate}</li>
            <li><strong>Horario:</strong> ${startTime} - ${endTime}</li>
            <li><strong>Club:</strong> ${club?.name || 'Club'}</li>
            <li><strong>Cancha:</strong> ${court?.name || 'Cancha'}</li>
            <li><strong>Motivo:</strong> ${effectiveReason}</li>
          </ul>
        </div>
      `,
      actionButton: {
        text: 'Explorar Otras Canchas',
        url: `${this.webUrl}/search`,
        color: '#16A34A',
      },
    });

    return this.sendEmail({
      to,
      subject: `❌ Reserva #${bookingReference} cancelada - TuCancha`,
      html,
    });
  }

  async sendBookingAutoConfirmedPendingAuditEmail(to: string, booking: Booking) {
    const { date, startTime, endTime, court, club, bookingReference, customerInfo } = booking;

    const formattedDate = new Date(date).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const html = this.getEmailTemplate({
      title: '¡Tu reserva ha sido confirmada con éxito!',
      greeting: `Hola ${customerInfo?.name || 'Cliente'},`,
      message: 'Hemos recibido tu comprobante de pago. Tu cancha está asegurada para tu partido. El club revisará el comprobante en su bandeja de auditoría.',
      bookingDetailsHtml: `
        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="color: #166534; font-weight: bold; margin: 0 0 10px 0;">✓ Cancha Reservada y Asegurada</p>
          <ul style="padding-left: 20px; color: #166534; margin: 0; line-height: 1.8;">
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

    return this.sendEmail({
      to,
      subject: '¡Reserva Confirmada! Tu cancha está asegurada - TuCancha',
      html,
    });
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const resetUrl = `${this.webUrl}/reset-password?token=${token}`;

    const html = this.getEmailTemplate({
      title: 'Restablecer contraseña',
      greeting: 'Hola,',
      message: `Has solicitado restablecer tu contraseña en <strong>TuCancha</strong>. Haz clic en el siguiente botón para establecer una nueva clave segura:<br/><br/>
                <em>Este enlace expirará en 20 minutos por motivos de seguridad.</em>`,
      actionButton: {
        text: 'Restablecer mi Contraseña',
        url: resetUrl,
        color: '#16A34A',
      },
      footerNote: 'Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.',
    });

    return this.sendEmail({
      to,
      subject: '🔐 Restablece tu contraseña - TuCancha',
      html,
    });
  }

  // Compatibilidad hacia atrás para llamadas legacy
  async sendClubActivationRequestToAdmin(club: {
    name: string;
    email: string;
    ownerEmail?: string;
    phone?: string | null;
  }, adminEmail: string = process.env.ADMIN_EMAIL || 'tucancha100@gmail.com') {
    return this.sendNewClubAdminNotificationEmail(adminEmail, club as any, { email: club.ownerEmail || club.email });
  }

  async sendClubRequestConfirmationToOwner(clubEmail: string, clubName: string, adminPhone: string = '933282785') {
    return this.sendClubRegisteredPendingApprovalEmail(clubEmail, { name: clubName, email: clubEmail, phone: adminPhone });
  }

  /**
   * Correo recordatorio cuando la prueba gratuita de 30 días está por vencer (3 días antes)
   */
  async sendTrialExpiringSoonEmail(
    to: string,
    clubName: string,
    daysLeft: number = 3,
    trialEndDate: Date,
    ownerName?: string,
  ) {
    const formattedDate = new Date(trialEndDate).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const membershipPlansUrl = `${this.webUrl}/club/membership`;

    const html = this.getEmailTemplate({
      title: '⏳ Tu periodo de prueba vence en 3 días',
      greeting: `Hola ${ownerName || clubName},`,
      message: `
        Te recordamos que tu <strong>periodo de prueba gratuita de 30 días</strong> en TuCancha está próximo a finalizar.<br/><br/>
        Tu prueba vencerá en <strong>${daysLeft} días</strong> (el <strong>${formattedDate}</strong>).
      `,
      bookingDetailsHtml: `
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #b45309; font-size: 15px;">🚀 ¡No detengas tus reservas deportivas!</h4>
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #78350f; line-height: 1.6;">
            Para que tus canchas sigan visibles en el buscador público, los jugadores puedan seguir reservando y continúes recibiendo pagos sin interrupciones, elije tu plan de membresía antes del <strong>${formattedDate}</strong>.
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #92400e; line-height: 1.8;">
            <li>Visibilidad permanente en el buscador para miles de deportistas.</li>
            <li>Gestión automatizada de reservas y cobros directos por Yape, Plin y Mercado Pago.</li>
            <li>Control total de canchas, horarios, tarifas y promociones.</li>
          </ul>
        </div>
      `,
      actionButton: {
        text: 'Elegir Plan y Continuar Activo',
        url: membershipPlansUrl,
        color: '#16A34A',
      },
      footerNote: 'El proceso de suscripción toma menos de 2 minutos. Si necesitas asistencia, contáctanos a soporte@tucancha.com.pe.',
    });

    return this.sendEmail({
      to,
      subject: `⏳ Tu prueba gratuita en TuCancha vence en ${daysLeft} días (${clubName})`,
      html,
    });
  }

  /**
   * Correo recordatorio cuando la membresía de pago está por vencer (3 días antes)
   */
  async sendMembershipExpiringSoonEmail(
    to: string,
    clubName: string,
    planName: string,
    daysLeft: number = 3,
    endDate: Date,
    ownerName?: string,
  ) {
    const formattedDate = new Date(endDate).toLocaleDateString('es-PE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const membershipPlansUrl = `${this.webUrl}/club/membership`;

    const html = this.getEmailTemplate({
      title: '⏳ Tu membresía vence en 3 días',
      greeting: `Hola ${ownerName || clubName},`,
      message: `
        Te recordamos que tu membresía <strong>${planName}</strong> en TuCancha está próxima a vencer.<br/><br/>
        Tu plan vencerá en <strong>${daysLeft} días</strong> (el <strong>${formattedDate}</strong>).
      `,
      bookingDetailsHtml: `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <h4 style="margin: 0 0 10px 0; color: #166534; font-size: 15px;">🛡️ Mantén tu club siempre activo:</h4>
          <p style="margin: 0 0 10px 0; font-size: 13px; color: #15803d; line-height: 1.6;">
            Renueva tu membresía a tiempo para evitar interrupciones en la visibilidad pública de tus canchas y en la recepción de reservas de tus clientes.
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #166534; line-height: 1.8;">
            <li>Continuidad de reservas en tiempo real sin interrupciones.</li>
            <li>Tus clientes seguirán reservando con normalidad.</li>
            <li>Soporte técnico y todas las herramientas de gestión activas.</li>
          </ul>
        </div>
      `,
      actionButton: {
        text: 'Renovar Membresía Ahora',
        url: membershipPlansUrl,
        color: '#16A34A',
      },
      footerNote: 'Si tu suscripción está configurada con renovación automática, no tienes que realizar ninguna acción.',
    });

    return this.sendEmail({
      to,
      subject: `⏳ Tu membresía en TuCancha vence en ${daysLeft} días (${clubName})`,
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
      actionButton: {
        text: 'Pagar y Renovar Ahora',
        url: `${this.webUrl}/club/membership`,
        color: '#D97706',
      },
    });

    return this.sendEmail({
      to,
      subject: '⚠️ Tu membresía está en periodo de gracia - TuCancha',
      html,
    });
  }

  async sendMembershipExpiredEmail(to: string, clubName: string) {
    const html = this.getEmailTemplate({
      title: 'Membresía Expirada - Canchas Ocultas',
      greeting: `Hola ${clubName},`,
      message: `Tu membresía en TuCancha ha expirado y el periodo de gracia ha finalizado. Tus canchas han sido ocultadas del catálogo público.`,
      actionButton: {
        text: 'Reactivar mis Canchas',
        url: `${this.webUrl}/club/membership`,
        color: '#16A34A',
      },
      footerNote: 'Puedes reactivar tu cuenta en cualquier momento renovando tu membresía.',
    });

    return this.sendEmail({
      to,
      subject: 'Tu membresía ha expirado - Canchas pausadas - TuCancha',
      html,
    });
  }

  async sendTrialExpiredEmail(to: string, clubName: string) {
    const html = this.getEmailTemplate({
      title: 'Prueba Gratuita Expirada - Canchas Suspendidas',
      greeting: `Hola ${clubName},`,
      message: `Tu periodo de prueba gratuita de 30 días en TuCancha ha finalizado. Para reactivar tu cuenta y continuar recibiendo reservas, por favor suscríbete a uno de nuestros planes.`,
      actionButton: {
        text: 'Suscribirse Ahora',
        url: `${this.webUrl}/club/membership`,
        color: '#16A34A',
      },
      footerNote: 'Puedes cancelar o renovar tu membresía en cualquier momento desde tu panel.',
    });

    return this.sendEmail({
      to,
      subject: 'Tu prueba gratuita en TuCancha ha vencido - Acceso suspendido',
      html,
    });
  }
}
