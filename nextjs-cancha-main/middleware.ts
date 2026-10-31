// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_ROUTES = ['/login', '/register']
const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  CLUB: '/club',
  RECEPCIONISTA: '/club',
  USER: '/user',
}

const ROUTE_PERMISSION_MAP: Record<string, string> = {
  '/club/dashboard': 'dashboard',
  '/club/payments': 'payments',
  '/club/transactions': 'transactions',
  '/club/schedules': 'schedules',
  '/club/events': 'events',
  '/club/courts': 'courts',
  '/club/bookings': 'bookings',
  '/club/membership': 'membership',
  '/club/loyalty': 'loyalty',
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // 1. Si no hay token y va a una ruta protegida → redirigir a login
  if (!token) {
    const isProtected = pathname.startsWith('/admin') || pathname.startsWith('/club') || pathname.startsWith('/user')
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  // 2. Si el usuario logueado va al login o registro → redirigir según su rol
  if (pathname === '/login' || pathname === '/register') {
    const userRole = (token?.role as string) || 'USER'
    const basePath = ROLE_ROUTES[userRole] || '/user'
    return NextResponse.redirect(new URL(`${basePath}/dashboard`, req.url))
  }

  // 3. Protección de rutas para ADMIN
  if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/no-autorizado', req.url))
  }

  // 4. Protección de rutas para USER (jugadores)
  if (pathname.startsWith('/user') && token.role !== 'USER') {
    return NextResponse.redirect(new URL('/no-autorizado', req.url))
  }

  // 5. Protección de rutas para CLUB, RECEPCIONISTA y ADMIN
  if (pathname.startsWith('/club')) {
    if (token.role !== 'CLUB' && token.role !== 'RECEPCIONISTA' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/no-autorizado', req.url))
    }

    // Regla especial: El módulo /club/users queda estrictamente reservado al administrador/dueño del club
    if (pathname.startsWith('/club/users') && token.role !== 'CLUB' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/no-autorizado', req.url))
    }

    // Para recepcionistas, validar si tienen asignado el permiso de la sección
    if (token.role === 'RECEPCIONISTA') {
      const permissions = (token.permissions as string[]) || []

      // Si entra a /club o /club/dashboard pero no tiene permiso 'dashboard', redirigir a su primer módulo habilitado
      if ((pathname === '/club' || pathname === '/club/dashboard') && !permissions.includes('dashboard') && permissions.length > 0) {
        const firstPerm = permissions[0]
        const fallbackRoute = Object.entries(ROUTE_PERMISSION_MAP).find(([, p]) => p === firstPerm)?.[0] || '/no-autorizado'
        return NextResponse.redirect(new URL(fallbackRoute, req.url))
      }

      for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSION_MAP)) {
        if (pathname.startsWith(routePrefix) && !permissions.includes(permKey)) {
          return NextResponse.redirect(new URL('/no-autorizado', req.url))
        }
      }
    }
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
