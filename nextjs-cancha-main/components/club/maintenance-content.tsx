"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { CourtsManagement } from "@/components/club/courts-management"
import { ScheduleManagement } from "@/components/club/schedule-management"

export function MaintenanceContent() {
  const [activeTab, setActiveTab] = useState("courts")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Mantenimiento</h2>
        <p className="text-muted-foreground">Gestiona las canchas y horarios de tu club deportivo.</p>
      </div>
      <Tabs defaultValue="courts" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courts">Canchas</TabsTrigger>
          <TabsTrigger value="schedules">Horarios</TabsTrigger>
        </TabsList>

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
