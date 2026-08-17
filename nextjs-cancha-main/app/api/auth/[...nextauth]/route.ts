// app/api/auth/[...nextauth]/route.ts (ajusta nombre y ubicación si es necesario)
import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import axios from "axios"
import {jwtDecode} from "jwt-decode"
type DecodedToken = {
  id: string
  name: string
  email: string
  clubId?:string;
  role: "USER" | "ADMIN" | "CLUB" // o `UserRole` si ya lo tienes definido
}
const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
            email: credentials?.email,
            password: credentials?.password,
          })
          const token = res.data.access_token
          const refreshToken = res.data.refresh_token;
          if (!token) return null
          const decoded = jwtDecode<DecodedToken>(token)
          return {
            id: decoded.id,
            name: decoded.name,
            email: decoded.email,
            role: decoded.role,
            accessToken: token, // opcional: puedes guardar el token para llamadas futuras
            refreshToken
          }
        } catch (error:any) {
          // Captura y lanza mensaje desde el backend
          const message =
          error?.response?.data?.message || "Error desconocido al iniciar sesión";

          console.error("Error en login backend:", message);

          // Lanza el error explícitamente para que NextAuth lo propague
          throw new Error(message);
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account}) {
      if (user) {
        token.role = user.role
        token.accessToken = (user as any).accessToken 
        token.refreshToken = (user as any).refreshToken; // 👈 nuevo
      }
      if (account?.provider === "google" && account.id_token) {
        try {
          const res = await axios.post(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/google`, {
            idToken: account.id_token,
          })
          const { access_token,refreshToken } = res.data
          const decoded = jwtDecode<DecodedToken>(access_token)
          token.accessToken = access_token
          token.refreshToken = refreshToken
          token.role = decoded.role
          token.name = decoded.name
          token.email = decoded.email
          token.sub = decoded.id // opcional
          token.clubId = decoded.clubId // opcional
  
        } catch (error:any) {
          console.error("Error al autenticar con Google en el backend:", error.response?.data || error.message)
          throw new Error("Fallo al iniciar sesión con Google: " + (error.response?.data?.message || error.message))
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string
        session.user.clubId = token.clubId as string
        session.accessToken = token.accessToken as string
        session.refreshToken = token.refreshToken as string
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
}
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
export { authOptions } // 👈 importante para usar en getServerSession
