import type { Metadata } from "next"
import { Suspense } from "react"

import { AppLayout } from "@/components/layout/app-layout"
import { SearchInterface } from "@/components/search-interface"

export const metadata: Metadata = {
  title: `Buscar Canchas | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Busca y reserva canchas deportivas",
}

interface UserSearchPageProps {
  searchParams: {
    sport?: string
    district?: string
    date?: string
    query?: string
    club?: string
    lat?: string
    lng?: string,
    timeSlot?: string
  }
}

export default async function UserSearchPage() {

  return (
    <AppLayout title="Buscar Canchas">
      <Suspense fallback={<div className="p-4">Cargando buscador...</div>}>
        <div className="flex-1 w-full p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          <SearchInterface />
        </div>
      </Suspense>
    </AppLayout>
  )
}
