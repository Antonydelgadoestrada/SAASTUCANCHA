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
      <Suspense fallback={<div>Cargando buscador...</div>}>
        <SearchInterface />
        {/* <SearchInterface searchParams={searchParams} isUserLoggedIn={true}/> */}
      </Suspense>
    </AppLayout>
  )
}
