import type { Metadata } from "next";
import { AppLayout } from "@/components/layout/app-layout";
import { ClubUsersContent } from "@/components/club/users-content";

export const metadata: Metadata = {
  title: `Gestión de Usuarios | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Administra el equipo y los usuarios recepcionistas de tu club",
};

export default function ClubUsersPage() {
  return (
    <AppLayout title="Usuarios">
      <ClubUsersContent />
    </AppLayout>
  );
}
