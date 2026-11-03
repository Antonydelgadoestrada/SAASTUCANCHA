// lib/session.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}
export async function getCurrentToken() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ?? null
}
