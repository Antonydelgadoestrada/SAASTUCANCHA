import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SearchInterface } from "@/components/search-interface"
import Image from "next/image"
import { AuthHeaderButtons } from "@/components/AuthHeaderButtons"

export const metadata: Metadata = {
  title: `Buscar Canchas | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Encuentra y reserva canchas deportivas cerca de ti",
}

interface SearchPageProps {
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

// export default async function SearchPage({ searchParams }: SearchPageProps) {
export default function SearchPage() {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
            <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
          />
              <span className="text-xl font-bold">TuCancha</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <AuthHeaderButtons></AuthHeaderButtons>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <Link href="/" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a la página principal
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Buscar Canchas Deportivas</h1>
          <p className="mt-2 text-muted-foreground">
            Encuentra la cancha perfecta cerca de ti usando nuestro buscador avanzado
          </p>
        </div>

        <Suspense fallback={<div>Cargando buscador...</div>}>
          <SearchInterface />
          {/* <SearchInterface searchParams={searchParams} isUserLoggedIn={false} /> */}
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-8">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
