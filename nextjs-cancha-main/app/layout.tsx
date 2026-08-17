import type { Metadata } from "next"
import { Inter } from "next/font/google"
// import { Toaster } from "sonner"
import { getServerSession } from "next-auth"
import { Toaster as SonnerToaster } from "sonner"
import { Toaster as CustomToaster } from "@/components/ui/toaster"

import { authOptions } from "./api/auth/[...nextauth]/route"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import "./globals.css"
import { SessionSync } from "@/components/SessionSync"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"
import { QueryProvider } from "@/components/QueryClientProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_APP_NAME} - Alquiler de Canchas Deportivas`,
  description: "Plataforma para alquiler y gestión de canchas deportivas",
  icons: {
    icon: '/favicon.png', 
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProviderWrapper session={session}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <QueryProvider>
              <SidebarProvider>
                <SessionSync />
                {children}
              </SidebarProvider>
              <SonnerToaster position="top-center" richColors />
                <CustomToaster/>
            </QueryProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
