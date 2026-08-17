// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_ROUTES = ['/login', '/register']
const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  CLUB: '/club',
  USER: '/user',
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl
  
  // 1. Si no hay token y va a una ruta protegida → redirigir
  if (!token) {
    const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/club') || pathname.startsWith('/user')
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  // 2. Si el usuario logueado va al login → redirigir según su rol
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.redirect(new URL(`${ROLE_ROUTES[token?.role]}/dashboard`, req.url))
  }

  // 3. Protección por rol
  if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/no-autorizado', req.url))
  }
  if (pathname.startsWith('/club') && token.role !== 'CLUB') {
    return NextResponse.redirect(new URL('/no-autorizado', req.url))
  }
  if (pathname.startsWith('/user') && token.role !== 'USER') {
    return NextResponse.redirect(new URL('/no-autorizado', req.url))
  }

  return NextResponse.next()
}


export const config = {
  matcher: [
    '/admin/:path*',
    '/club/:path*',
    '/user/:path*',
    '/login',
    '/register'
  ],
}
