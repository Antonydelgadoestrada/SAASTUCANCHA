import type { Metadata } from "next"

import { AppLayout } from "@/components/layout/app-layout"
import { MercadopagoContent } from "@/components/club/mercadopago-content"
import { getCurrentToken } from "@/lib/session"
import { jwtDecode } from "jwt-decode"

export const metadata: Metadata = {
  title: `Mercadopago | ${process.env.NEXT_PUBLIC_APP_NAME}`,
  description: "Dar permisos a mercadopago",
}

export default async function MarcadopagoPage() {
    const token = await getCurrentToken()
    if(!token) return (null)
    const decoded = jwtDecode<any>(token)
    if(!decoded.clubId) return null
   
  return (
    <AppLayout title="Mercadopago">
      <MercadopagoContent clubId={decoded?.clubId}/>
    </AppLayout>
  )
}
