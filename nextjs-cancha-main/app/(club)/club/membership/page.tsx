import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { MembershipContent } from "@/components/club/membership-content"

export const metadata: Metadata = {
  title: `Membresía del Club | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: `Gestiona la suscripción y pagos de membresía de tu club en ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
}

export default async function ClubMembershipPage() {
  return (
    <AppLayout title="Membresía del Club">
      <MembershipContent />
    </AppLayout>
  )
}
