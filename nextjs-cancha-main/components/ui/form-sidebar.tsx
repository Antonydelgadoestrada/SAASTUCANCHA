"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CalendarIcon, SparklesIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

interface TabContent {
  id: string
  title: string
  description?: string
  content: React.ReactNode
}

const TAB_NAV: Record<string, { icon: React.ReactNode; label: string }> = {
  horarios: { icon: <CalendarIcon className="h-4 w-4" />, label: "Horarios" },
  eventos: { icon: <SparklesIcon className="h-4 w-4" />, label: "Eventos" },
}

interface FormSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tabs: TabContent[]
  defaultTab?: string
  footer?: React.ReactNode
  side?: "left" | "right"
  className?: string
}

export function FormSidebar({
  open,
  onOpenChange,
  tabs,
  defaultTab,
  footer,
  side = "right",
  className,
}: FormSidebarProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id)

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0]

  React.useEffect(() => {
    const ids = tabs.map((t) => t.id)
    if (ids.length === 0) return
    if (!ids.includes(activeTab)) {
      const next =
        defaultTab && ids.includes(defaultTab) ? defaultTab : ids[0]
      setActiveTab(next)
    }
  }, [tabs, defaultTab, open, activeTab])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "w-full sm:max-w-lg lg:max-w-xl overflow-hidden flex flex-col",
          className,
        )}
      >
        <div className="border-b bg-muted/30 px-6 py-3">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const meta = TAB_NAV[tab.id] ?? {
                icon: <CalendarIcon className="h-4 w-4" />,
                label: tab.title,
              }
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3",
                    activeTab === tab.id && "bg-primary text-primary-foreground",
                  )}
                >
                  {meta.icon}
                  <span className="text-sm font-medium">{meta.label}</span>
                </Button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>{currentTab?.title}</SheetTitle>
            {currentTab?.description && (
              <SheetDescription>{currentTab.description}</SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">{currentTab?.content}</div>

          {footer && (
            <div className="border-t px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
