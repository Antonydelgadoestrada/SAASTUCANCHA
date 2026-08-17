"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface RecentUsersProps {
  users: any[]
}

export function AdminRecentUsers({ users }: RecentUsersProps) {
  if (!users || users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
        No hay usuarios recientes registrados.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {users.map((user) => {
        const initials = user.name
          ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
          : "U"

        // Formatear fecha de creación
        const createdDate = user.createdAt ? new Date(user.createdAt) : new Date()

        return (
          <div key={user.id} className="flex items-center">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="ml-4 space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="ml-auto flex flex-col items-end gap-1">
              <Badge
                variant={user.role === "ADMIN" ? "secondary" : user.role === "CLUB" ? "outline" : "default"}
                className="flex items-center gap-1"
              >
                {user.role === "CLUB" ? (
                  <ClockIcon className="h-3 w-3 text-orange-500" />
                ) : (
                  <CheckCircleIcon className="h-3 w-3 text-green-500" />
                )}
                {user.role === "ADMIN" ? "Admin" : user.role === "CLUB" ? "Club" : "Usuario"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(createdDate, "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
