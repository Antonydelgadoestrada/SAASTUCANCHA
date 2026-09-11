"use client"

import { usePathname } from "next/navigation"
import {
  CalendarIcon,
  CreditCardIcon,
  HomeIcon,
  LayoutDashboardIcon,
  ListIcon,
  MapPinIcon,
  PlusCircleIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  SparklesIcon,
} from "lucide-react"

import { UserNav } from "@/components/layout/user-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import type { User } from "@/lib/types"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import api from "@/lib/axios"
import { getMyClubMembership } from "@/lib/membership"
import { LockIcon } from "lucide-react"

interface AppSidebarProps {
  user: User
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  const clubId = (user as any)?.clubId || (user as any)?.club?.id

  // 1. Consultar estado de membresía del club si el usuario es CLUB
  const { data: membershipData, isLoading: isLoadingMembership } = useQuery({
    queryKey: ["club-membership"],
    queryFn: getMyClubMembership,
    enabled: user.role === "CLUB",
  })

  // 2. Consultar datos del club
  const { data: clubData, isLoading: isLoadingClub } = useQuery({
    queryKey: ["club-profile", clubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}`)
      return res.data
    },
    enabled: user.role === "CLUB" && Boolean(clubId),
  })

  const hasPaidMembership = Boolean(
    membershipData?.membership &&
    (membershipData.membership.status === "ACTIVE" || membershipData.membership.status === "GRACE")
  )

  const isTrialActive = Boolean(
    clubData?.trialEndDate &&
    new Date(clubData.trialEndDate) > new Date() &&
    clubData.status === "APPROVED"
  )

  const isClubSuspended = Boolean(
    user.role === "CLUB" &&
    !isLoadingMembership &&
    !hasPaidMembership &&
    (!isTrialActive || clubData?.status === "SUSPENDED")
  )

  // Menú para usuarios normales
  const userMenu = [
    {
      title: "Dashboard",
      icon: LayoutDashboardIcon,
      href: "/user/dashboard",
      active: isActive("/user/dashboard"),
    },
    {
      title: "Buscar Canchas",
      icon: SearchIcon,
      href: "/user/search",
      active: isActive("/user/search"),
    },
    {
      title: "Mis Reservas",
      icon: CalendarIcon,
      href: "/user/bookings",
      active: isActive("/user/bookings"),
    },
  ]

  // Menú para clubes
  const clubMenu = [
    {
      title: "Dashboard",
      icon: LayoutDashboardIcon,
      href: "/club/dashboard",
      active: isActive("/club/dashboard"),
      locked: isClubSuspended,
    },
    {
      title: "Pagos y Cobros",
      icon: CreditCardIcon,
      href: "/club/payments",
      active: isActive("/club/payments"),
      locked: isClubSuspended,
    },
    {
      title: "Horarios",
      icon: CalendarIcon,
      href: "/club/schedules",
      active: isActive("/club/schedules"),
      locked: isClubSuspended,
    },
    {
      title: "Eventos y Bloqueos",
      icon: SparklesIcon,
      href: "/club/events",
      active: isActive("/club/events"),
      locked: isClubSuspended,
    },
    {
      title: "Canchas",
      icon: HomeIcon,
      href: "/club/courts",
      active: isActive("/club/courts"),
      locked: isClubSuspended,
    },
    {
      title: "Reservas",
      icon: ListIcon,
      href: "/club/bookings",
      active: isActive("/club/bookings"),
      locked: isClubSuspended,
    },
    {
      title: "Membresía",
      icon: CreditCardIcon,
      href: "/club/membership",
      active: isActive("/club/membership"),
      locked: false,
      highlight: isClubSuspended,
    },
  ]

  // Menú para administradores
  const adminMenu = [
    {
      title: "Dashboard",
      icon: LayoutDashboardIcon,
      href: "/admin/dashboard",
      active: isActive("/admin/dashboard"),
    },
    {
      title: "Solicitudes",
      icon: ListIcon,
      href: "/admin/requests",
      active: isActive("/admin/requests"),
    },
  ]

  // Determinar qué menú mostrar según el rol del usuario
  const menuItems = user.role === "ADMIN" ? adminMenu : user.role === "CLUB" ? clubMenu : userMenu

  const handleLockedClick = (e: React.MouseEvent, title: string) => {
    e.preventDefault()
    toast.error(`Acceso restringido a "${title}"`, {
      description: "Tu cuenta se encuentra suspendida por falta de pago de membresía. Por favor regulariza tu mensualidad en la sección de Membresía para desbloquear todas las funciones.",
    })
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="/">
                <span className="text-base font-semibold">{process.env.NEXT_PUBLIC_APP_NAME}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {menuItems.map((item: any) => {
                if (item.locked) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={`${item.title} (Bloqueado por falta de pago)`}
                        className="opacity-50 cursor-not-allowed hover:bg-transparent"
                        onClick={(e) => handleLockedClick(e, item.title)}
                      >
                        <item.icon className="text-muted-foreground" />
                        <span className="text-muted-foreground line-through decoration-muted-foreground/50">{item.title}</span>
                        <LockIcon className="w-3.5 h-3.5 ml-auto text-amber-500 shrink-0" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={item.active}>
                      <a href={item.href} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <item.icon />
                          <span>{item.title}</span>
                        </div>
                        {item.highlight && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-destructive text-white animate-pulse">
                            Pagar
                          </span>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <UserNav user={{name:user.name ?? 'C', email:user.email ?? 'C', image:''}} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
