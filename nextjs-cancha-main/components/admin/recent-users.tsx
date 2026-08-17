"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircleIcon, ClockIcon, XCircleIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

// Datos de ejemplo
const recentUsers = [
  {
    id: 1,
    name: "Juan Pérez",
    email: "juan@example.com",
    role: "USER",
    status: "active",
    createdAt: new Date(2025, 5, 10),
  },
  {
    id: 2,
    name: "Club Deportivo Central",
    email: "central@example.com",
    role: "CLUB",
    status: "pending",
    createdAt: new Date(2025, 5, 11),
  },
  {
    id: 3,
    name: "María López",
    email: "maria@example.com",
    role: "USER",
    status: "active",
    createdAt: new Date(2025, 5, 12),
  },
  {
    id: 4,
    name: "Club Deportivo Norte",
    email: "norte@example.com",
    role: "CLUB",
    status: "active",
    createdAt: new Date(2025, 5, 12),
  },
  {
    id: 5,
    name: "Carlos Rodríguez",
    email: "carlos@example.com",
    role: "USER",
    status: "inactive",
    createdAt: new Date(2025, 5, 13),
  },
]

export function AdminRecentUsers() {
  return (
    <div className="space-y-8">
      {recentUsers.map((user) => (
        <div key={user.id} className="flex items-center">
          <Avatar className="h-9 w-9">
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4 space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <Badge
              variant={user.status === "active" ? "default" : user.status === "pending" ? "outline" : "destructive"}
              className="flex items-center gap-1"
            >
              {user.status === "active" ? (
                <CheckCircleIcon className="h-3 w-3" />
              ) : user.status === "pending" ? (
                <ClockIcon className="h-3 w-3" />
              ) : (
                <XCircleIcon className="h-3 w-3" />
              )}
              {user.role === "USER" ? "Usuario" : "Club"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(user.createdAt, "d MMM yyyy", { locale: es })}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
