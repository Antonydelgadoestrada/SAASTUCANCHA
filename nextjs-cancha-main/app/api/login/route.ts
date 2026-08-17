

// /app/api/login/route.ts (Next.js App Router)
import { loginUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  // Verifica usuario
  const user = await loginUser(email, password) // ← tu función

  const response = NextResponse.json({ success: true })

  response.cookies.set('user', JSON.stringify(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 día
  })

  return response
}
