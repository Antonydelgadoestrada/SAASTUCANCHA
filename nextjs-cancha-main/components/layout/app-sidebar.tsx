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
import { json } from "stream/consumers"

interface AppSidebarProps {
  user: User
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`)
  }

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
    },
    {
      title: "Pagos y Cobros",
      icon: CreditCardIcon,
      href: "/club/payments",
      active: isActive("/club/payments"),
    },
    {
      title: "Horarios",
      icon: CalendarIcon,
      href: "/club/schedules",
      active: isActive("/club/schedules"),
    },
    {
      title: "Eventos y Bloqueos",
      icon: SparklesIcon,
      href: "/club/events",
      active: isActive("/club/events"),
    },
    {
      title: "Canchas",
      icon: HomeIcon,
      href: "/club/courts",
      active: isActive("/club/courts"),
    },
  
    {
      title: "Reservas",
      icon: ListIcon,
      href: "/club/bookings",
      active: isActive("/club/bookings"),
    },
    {
      title: "Membresía",
      icon: CreditCardIcon,
      href: "/club/membership",
      active: isActive("/club/membership"),
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
    // {
    //   title: "Configuración",
    //   icon: SettingsIcon,
    //   href: "/admin/settings",
    //   active: isActive("/admin/settings"),
    // },
  ]

  // Determinar qué menú mostrar según el rol del usuario
  const menuItems = user.role === "ADMIN" ? adminMenu : user.role === "CLUB" ? clubMenu : userMenu

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
            {user.role === "USER" && (
              <SidebarMenu>
                <SidebarMenuItem className="flex items-center gap-2">
                  <SidebarMenuButton
                    asChild
                    tooltip="Reservar Cancha"
                    className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  >
                    <a href="/user/search">
                      <PlusCircleIcon />
                      <span>Reservar Cancha</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={item.active}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
