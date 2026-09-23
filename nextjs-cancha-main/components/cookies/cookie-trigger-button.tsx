"use client"

import { Cookie } from "lucide-react"
import { triggerOpenCookiePreferences } from "@/lib/cookie-consent"
import { Button } from "@/components/ui/button"

interface CookieTriggerButtonProps {
  variant?: "link" | "outline" | "ghost" | "default"
  className?: string
  showIcon?: boolean
}

export function CookieTriggerButton({
  variant = "link",
  className = "",
  showIcon = true,
}: CookieTriggerButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => triggerOpenCookiePreferences()}
      className={`h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground ${className}`}
    >
      {showIcon && <Cookie className="mr-1.5 h-3.5 w-3.5 inline" />}
      Configuración de Cookies
    </Button>
  )
}
