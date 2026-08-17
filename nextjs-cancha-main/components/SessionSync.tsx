// components/SessionSync.tsx
"use client"

import { useSyncSessionToStore } from "@/hooks/useSyncSessionToStore"

export function SessionSync() {
  useSyncSessionToStore()
  return null // no renderiza nada visible
}
