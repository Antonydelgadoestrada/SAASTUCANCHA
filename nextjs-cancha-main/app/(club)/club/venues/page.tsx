import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { VenuesContent } from "@/components/club/venues-content"

export const metadata: Metadata = {
  title: `Gestión de Sedes | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Administra las sedes de tu club deportivo",
}

export default async function ClubVenuesPage() {
  return (
    <AppLayout title="Gestión de Sedes">
      <VenuesContent />
    </AppLayout>
  )
}
