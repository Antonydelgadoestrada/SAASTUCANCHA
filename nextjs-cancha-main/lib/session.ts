// lib/session.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}
export async function getCurrentToken() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ?? null
}
