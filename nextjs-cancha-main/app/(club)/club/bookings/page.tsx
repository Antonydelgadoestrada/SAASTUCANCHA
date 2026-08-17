import type { Metadata } from "next";
import { ReservationsContent } from "@/components/club/reservations-content";
import { AppLayout } from "@/components/layout/app-layout";

export const metadata: Metadata = {
  title: `Gestión de Reservas | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Administra todas las reservas de tus canchas deportivas",
};

export default function ReservationsPage() {
  return (
    <AppLayout title="Gestión de Canchas">
      <ReservationsContent />
    </AppLayout>
  );
}
