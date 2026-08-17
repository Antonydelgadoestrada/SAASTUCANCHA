"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VenuesManagement } from "@/components/club/venues-management"
import { CourtsManagement } from "@/components/club/courts-management"
import { ScheduleManagement } from "@/components/club/schedule-management"

export function MaintenanceContent() {
  const [activeTab, setActiveTab] = useState("venues")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Mantenimiento</h2>
        <p className="text-muted-foreground">Gestiona las sedes, canchas y horarios de tu club deportivo.</p>
      </div>

      <Tabs defaultValue="venues" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="venues">Sedes</TabsTrigger>
          <TabsTrigger value="courts">Canchas</TabsTrigger>
          <TabsTrigger value="schedules">Horarios</TabsTrigger>
        </TabsList>
        <TabsContent value="venues" className="mt-6">
          <VenuesManagement />
        </TabsContent>
        <TabsContent value="courts" className="mt-6">
          <CourtsManagement />
        </TabsContent>
        <TabsContent value="schedules" className="mt-6">
          <ScheduleManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
