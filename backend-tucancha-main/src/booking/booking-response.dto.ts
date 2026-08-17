import { BookingStatus } from './booking-status.enum';
import { PaymentStatus } from '../payment/payment-status.enum';

export class BookingResponseDto {
  id: string;

  date: Date;

  startTime: string;

  endTime: string;

  duration: number;

  customerInfo: {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  };

  pricing: {
    basePrice: number;
    discounts: number;
    taxes: number;
    totalPrice: number;
  };

  status: BookingStatus;

  paymentStatus: PaymentStatus;

  bookingReference: string;

  createdAt: Date;

  updatedAt: Date;

  cancelledAt?: Date;

  cancellationReason?: string;
}
