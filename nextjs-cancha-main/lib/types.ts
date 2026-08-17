// types/next-auth.d.ts
import NextAuth, { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role?: string
      name?: string
      clubId?: string
      email?: string
    } & DefaultSession["user"],
    accessToken?: string
    refreshToken?: string;
  }

  interface User extends DefaultUser {
    id: string
    role?: string
    clubId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    accessToken?: string;
    refreshToken?: string;
    role?: string;
    clubId?: string;
    email?: string;
    name?: string;
    sub?: string;
  }
}

export type UserRole = "USER" | "CLUB" | "ADMIN"

export interface User {
  id?: string
  name?: string
  email?: string
  role?: any
  clubId?:string
  accessToken?:string
}

export interface Court {
  id: number
  name: string
  venue: string
  sport: string
  basePrice: number
  morningPrice: number
  eveningPrice: number
  weekendPrice: number
  hasPromotion: boolean
  promotionPrice: number | null
  promotionDays: string[]
  promotionHours: string[]
}

export interface Booking {
  id: number
  courtName: string
  venueName: string
  venueImage: string
  date: Date
  duration: number
  status: "pending" | "confirmed" | "cancelled" | "completed"
  price: number
}

export interface Club {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  createdAt: Date
  approvedAt?: Date
  description: string
}

export type Venue = {
  id: number
  name: string
  phone: string
  email: string
  description: string
  image?: string
  capacity: string
  openingHours: string
  services: string[] // ← Aquí lo haces requerido explícitamente
  accessibilityFeatures?: string
  addressReference?: string
  specialInstructions?: string
  location: {
    address: string
    coordinates: { lat: number; lng: number }
  }
}
