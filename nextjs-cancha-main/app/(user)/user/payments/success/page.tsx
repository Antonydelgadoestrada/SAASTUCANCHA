// app/user/payments/success/page.tsx

import { CheckCircle } from "lucide-react"
import Link from "next/link"

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <CheckCircle className="text-green-500 w-16 h-16 mb-4" />
      <h1 className="text-2xl font-semibold mb-2">¡Pago exitoso!</h1>
      <p className="text-gray-600 mb-4">Tu reserva ha sido confirmada correctamente.</p>
      <Link href="/user/bookings" className="text-blue-500 underline">
        Ver mis reservas
      </Link>
    </div>
  )
}
