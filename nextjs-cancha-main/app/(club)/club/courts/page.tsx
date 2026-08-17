import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { ClubCourtsContent } from "@/components/club/courts-content"

export const metadata: Metadata = {
  title: `Gestión de Canchas | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Gestiona tus canchas deportivas",
}

export default async function ClubCourtsPage() {
  return (
    <AppLayout title="Gestión de Canchas">
      <ClubCourtsContent />
    </AppLayout>
  )
}
