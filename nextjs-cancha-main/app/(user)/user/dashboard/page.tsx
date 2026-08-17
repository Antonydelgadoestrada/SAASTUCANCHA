import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { UserDashboardContent } from "@/components/user/dashboard-content"

export const metadata: Metadata = {
  title: `Dashboard | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Dashboard de usuario en process.env.NEXT_PUBLIC_APP_NAME",
}

export default async function UserDashboardPage() {
  return (
    <AppLayout title="Dashboard">
      <UserDashboardContent />
    </AppLayout>
  )
}
