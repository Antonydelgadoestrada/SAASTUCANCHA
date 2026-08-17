import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { ClubPricingContent } from "@/components/club/pricing-content"

export const metadata: Metadata = {
  title: `Gestión de Precios | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Configura los precios de tus canchas deportivas",
}

export default async function ClubPricingPage() {
  return (
    <AppLayout title="Gestión de Precios">
      <ClubPricingContent />
    </AppLayout>
  )
}
