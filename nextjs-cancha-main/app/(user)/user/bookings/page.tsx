import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { UserBookingsContent } from "@/components/user/bookings-content"

export const metadata: Metadata = {
  title: `Mis Reservas | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Gestiona tus reservas de canchas deportivas",
}

export default async function UserBookingsPage() {
  return (
    <AppLayout title="Mis Reservas">
      <UserBookingsContent />
    </AppLayout>
  )
}
