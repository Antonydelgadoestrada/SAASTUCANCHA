import type { ReactNode } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getCurrentUser } from "@/lib/session"
interface AppLayoutProps {
  children: ReactNode
  title?: string
}

export async function AppLayout({ children, title }: AppLayoutProps) {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <SiteHeader title={title} />
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
