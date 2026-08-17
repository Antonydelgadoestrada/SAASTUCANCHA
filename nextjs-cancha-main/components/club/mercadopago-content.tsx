"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckIcon } from "lucide-react"
import { toast } from "sonner"
import { connectMercadopago } from "@/lib/mercadopago"

// Asegúrate de tener esta función en tu lib/api o lib/club

interface Props {
    clubId: any
}

export function MercadopagoContent({ clubId }: Props) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      const url = await connectMercadopago(clubId)

      if (url) {
        window.location.href = url // redirección
      } else {
        toast.error("No se recibió la URL de redirección")
      }
    } catch (error) {
      toast.error("Error al conectar con MercadoPago")
    } finally {
      toast.success("Se conecto satisfactoriamente MecadoPago")

      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">MercadoPago</h2>
        <p className="text-muted-foreground">Conecta tu cuenta de MercadoPago para recibir pagos</p>
      </div>

      <Button size="sm" onClick={handleConnect} disabled={isLoading}>
        <CheckIcon className="mr-1 h-4 w-3" />
        {isLoading ? "Conectando..." : "Conectarme a MercadoPago"}
      </Button>
    </div>
  )
}
