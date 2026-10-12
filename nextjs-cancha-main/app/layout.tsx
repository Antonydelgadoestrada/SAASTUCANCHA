import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
// import { Toaster } from "sonner"
// import { getServerSession } from "next-auth"
import { Toaster as SonnerToaster } from "sonner"
import { Toaster as CustomToaster } from "@/components/ui/toaster"

// import { authOptions } from "./api/auth/[...nextauth]/route"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { CookieConsentBanner } from "@/components/cookies/cookie-consent-banner"
import { JsonLd } from "@/components/seo/json-ld"
import "./globals.css"
import { SessionSync } from "@/components/SessionSync"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"
import { QueryProvider } from "@/components/QueryClientProvider"

const inter = Inter({ subsets: ["latin"] })

const APP_URL = process.env.NEXTAUTH_URL || "https://tucancha.com.pe"

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Tu Cancha | Reserva de Canchas Deportivas y Sintéticas en Perú",
    template: "%s | Tu Cancha Perú",
  },
  description:
    "Tu Cancha es la plataforma líder en el Perú para buscar, reservar y alquilar canchas sintéticas y deportivas en tiempo real. Fútbol 7, fútbol 11, pádel, tenis y vóley en Lima y a nivel nacional.",
  keywords: [
    "tu cancha",
    "tucancha",
    "tu cancha peru",
    "tucancha peru",
    "alquiler de canchas",
    "reserva de canchas",
    "canchas sinteticas",
    "canchas de futbol lima",
    "canchas de padel lima",
    "canchas de tenis peru",
    "canchas de voley lima",
    "reserva tu cancha",
    "alquiler de canchas de futbol",
    "futbol 7 lima",
    "futbol 11 lima",
    "canchas sinteticas lima peru",
    "complejos deportivos peru",
  ],
  authors: [{ name: "Tu Cancha", url: APP_URL }],
  creator: "Tu Cancha",
  publisher: "Tu Cancha",
  applicationName: "Tu Cancha",
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: APP_URL,
    siteName: "Tu Cancha",
    title: "Tu Cancha | Reserva de Canchas Deportivas y Sintéticas en Perú",
    description:
      "Encuentra y reserva canchas sintéticas de fútbol, pádel, tenis y vóley en segundos. Disponibilidad en tiempo real en los mejores complejos deportivos de Perú.",
    images: [
      {
        url: "/general.jpeg",
        width: 1200,
        height: 630,
        alt: "Tu Cancha Perú - Reserva de Canchas Deportivas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tu Cancha | Reserva de Canchas Deportivas y Sintéticas en Perú",
    description:
      "Encuentra y reserva canchas sintéticas de fútbol, pádel, tenis y vóley en segundos en todo el Perú.",
    images: ["/general.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/favicon.png",
  },
  manifest: "/manifest.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
  other: {
    "geo.region": "PE-LIM",
    "geo.placename": "Lima, Perú",
    "geo.position": "-12.046374;-77.042793",
    ICBM: "-12.046374, -77.042793",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // const session = await getServerSession(authOptions)

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <JsonLd />
        <SessionProviderWrapper>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <QueryProvider>
              <SidebarProvider>
                <SessionSync />
                {children}
              </SidebarProvider>
              <SonnerToaster position="top-center" richColors />
              <CustomToaster/>
              <CookieConsentBanner />
            </QueryProvider>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
