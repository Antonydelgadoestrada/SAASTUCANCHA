// app/user/payments/failure/page.tsx

import { XCircle } from "lucide-react"
import Link from "next/link"

export default function PaymentFailurePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <XCircle className="text-red-500 w-16 h-16 mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Pago fallido</h1>
      <p className="text-gray-600 mb-4">Hubo un problema al procesar tu pago. Intenta nuevamente.</p>
      <Link href="/user/bookings" className="text-blue-500 underline">
        Volver a mis reservas
      </Link>
    </div>
  )
}
