"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import api from "@/lib/axios"
import { getMyClubMembership } from "@/lib/membership"
import { AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export function TrialBanner() {
  const { data: session } = useSession()
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [hasPaidMembership, setHasPaidMembership] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!session || session.user.role !== "CLUB" || !session.user.clubId) {
      setIsLoading(false)
      return
    }

    async function checkTrialStatus() {
      try {
        // 1. Verificar si tiene membresía de pago activa
        const membershipData = await getMyClubMembership()
        if (membershipData?.membership) {
          setHasPaidMembership(true)
          setIsLoading(false)
          return
        }

        // 2. Si no tiene membresía activa, consultar los detalles del club
        const clubRes = await api.get(`/clubs/${session?.user.clubId}`)
        const club = clubRes.data

        if (club && club.trialEndDate) {
          const diffTime = new Date(club.trialEndDate).getTime() - Date.now()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setTrialDaysLeft(diffDays >= 0 ? diffDays : 0)
        }
      } catch (error) {
        console.error("Error al consultar el estado de la prueba gratuita:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkTrialStatus()
  }, [session])

  if (isLoading || hasPaidMembership || trialDaysLeft === null || !session) {
    return null
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs md:text-sm py-2.5 px-4 flex flex-wrap items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-100" />
        <span>
          <strong>Prueba gratuita en curso:</strong> Te quedan <strong>{trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}</strong> de acceso.
        </span>
      </div>
      <Link 
        href="/club/membership" 
        className="flex items-center gap-1 font-semibold hover:underline text-amber-100 hover:text-white transition-colors"
      >
        <span>Si deseas renovar o suscribirte, haz clic aquí</span>
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
