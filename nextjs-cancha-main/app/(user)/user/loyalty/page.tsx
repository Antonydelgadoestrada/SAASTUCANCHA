import type { Metadata } from "next";

import { AppLayout } from "@/components/layout/app-layout";
import { UserLoyaltyContent } from "@/components/user/loyalty-content";

export const metadata: Metadata = {
  title: `Mis Puntos de Fidelidad | ${process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}`,
  description: `Consulta tus puntos acumulados por reservas y canjéalos por premios en ${
    process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"
  }`,
};

export default function UserLoyaltyPage() {
  return (
    <AppLayout title="Mis Puntos de Fidelidad">
      <UserLoyaltyContent />
    </AppLayout>
  );
}
