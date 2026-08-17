import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { ClubDashboardContent } from "@/components/club/dashboard-content"

export const metadata: Metadata = {
  title: `Dashboard de Club | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: `Dashboard para clubes en ${process.env.NEXT_PUBLIC_APP_NAME}`,
}

export default async function ClubDashboardPage() {
  return (
    <AppLayout title="Dashboard de Club">
      <ClubDashboardContent />
    </AppLayout>
  )
}
