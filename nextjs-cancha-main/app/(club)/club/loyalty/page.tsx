import type { Metadata } from "next";

import { AppLayout } from "@/components/layout/app-layout";
import { LoyaltyContent } from "@/components/club/loyalty-content";

export const metadata: Metadata = {
  title: `Puntos y Fidelidad | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: `Configura tu programa de fidelidad por puntos y gestiona canjes de premios en ${
    process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"
  }`,
};

export default function ClubLoyaltyPage() {
  return (
    <AppLayout title="Puntos y Fidelidad">
      <LoyaltyContent />
    </AppLayout>
  );
}
