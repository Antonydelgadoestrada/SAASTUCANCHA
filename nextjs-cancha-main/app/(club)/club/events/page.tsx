import { EventsManager } from "@/components/club/events-manager"
import { AppLayout } from "@/components/layout/app-layout"
import { Suspense } from "react"

export default function EventsPage() {
  return (
    <AppLayout title="Eventos y Bloqueos">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground font-semibold">Cargando eventos...</div>}>
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <EventsManager />
            </div>
          </div>
        </div>
      </Suspense>
    </AppLayout>
  )
}
