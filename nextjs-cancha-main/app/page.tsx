import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calendar, CheckCircle, MapPin, Search, Shield, Star, Mail, Phone, Facebook, Instagram, MessageSquare, Award, Clock, Users, ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PublicSearchForm } from "@/components/public-search-form"
import { TestimonialsSection } from "@/components/testimonials-section"
import { PricingSection } from "@/components/pricing-section"
import { AuthHeaderButtons } from "@/components/AuthHeaderButtons"
import { FeaturesCarousel } from "@/components/features-carousel"
import { FaqSection } from "@/components/faq-section"
import { LandingNav } from "@/components/landing-nav"
import { CookieTriggerButton } from "@/components/cookies/cookie-trigger-button"
export const revalidate = 3600; // SSG con ISR (Revalida cada 1h)

export default async function HomePage() {
  return (
    <div className="flex w-full min-h-screen flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <div className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10">
              <Image
                src="/logo.png"
                alt="Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              {process.env.NEXT_PUBLIC_APP_NAME}
            </span>
          </Link>
          <LandingNav />
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <AuthHeaderButtons />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-32 lg:pb-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
          <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-5xl bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent blur-3xl" />
          
          <div className="container grid gap-8 lg:grid-cols-12 lg:gap-8 px-4 sm:px-6">
            <div className="flex flex-col justify-center space-y-5 sm:space-y-6 lg:col-span-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs sm:text-sm font-medium text-primary">
                <Award className="h-4 w-4 shrink-0" />
                <span>Tu Cancha • Plataforma #1 en Perú para reserva de canchas</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-tight">
                Tu Cancha: Reserva canchas deportivas y sintéticas en Perú{" "}
                <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-600 bg-clip-text text-transparent">
                  en segundos
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                Encuentra, compara y reserva tu cancha deportiva favorita en tiempo real. Alquiler de canchas sintéticas de fútbol, pádel, tenis y vóley en Lima y todo el Perú.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row pt-2 w-full sm:w-auto">
                <Link href="#search" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto h-12 px-6 text-base gap-2 rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                    <Search className="h-5 w-5" />
                    Buscar Canchas
                  </Button>
                </Link>
                <Link href="/register?type=club" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-6 text-base gap-2 rounded-xl transition-all hover:bg-muted hover:-translate-y-0.5">
                    Registra tu Club
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Stats / Trust Badges */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-8 sm:pt-10 border-t border-border/40">
                <div className="space-y-0.5 sm:space-y-1">
                  <h4 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">+50K</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Reservas hechas</p>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <h4 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">99.9%</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Puntualidad</p>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  <h4 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">+100</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">Clubes asociados</p>
                </div>
              </div>
            </div>

            {/* Right Illustration side */}
            <div className="relative lg:col-span-5 flex items-center justify-center">
              <div className="relative w-full max-w-[450px] aspect-square">
                {/* Glow Backdrop */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-emerald-500 rounded-3xl opacity-10 blur-2xl transform rotate-6 scale-95" />
                <div className="absolute inset-0 bg-gradient-to-bl from-teal-500 to-indigo-500 rounded-3xl opacity-10 blur-2xl transform -rotate-6 scale-95" />
                
                {/* Premium Image Frame */}
                <div className="relative h-full w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-muted">
                  <Image
                    src="/general.jpeg"
                    alt="Tu Cancha - Reserva de canchas sintéticas y deportivas en Perú"
                    fill
                    sizes="(max-width: 768px) 100vw, 450px"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  
                  {/* Floating badge */}
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-background/90 backdrop-blur border border-border/40 shadow-lg flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">Disponibilidad en tiempo real</p>
                      <p className="text-sm font-bold truncate text-foreground">Reserva sin esperas telefónicas</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* Features Section */}
        <section id="features" className="py-24 border-t border-border/40">
          <div className="container space-y-16">
            <div className="mx-auto max-w-3xl text-center space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Todo lo que necesitas en un solo lugar
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {process.env.NEXT_PUBLIC_APP_NAME} ofrece las herramientas más avanzadas para digitalizar tu complejo deportivo y facilitar el juego a tus clientes.
              </p>
            </div>

            <FeaturesCarousel />
          </div>
        </section>

        {/* Search Section */}
        <section id="search" className="bg-muted/40 py-20 border-t border-border/40">
          <div className="container">
            <div className="mx-auto mb-12 max-w-3xl text-center space-y-3">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Encuentra y reserva tu cancha ideal en Perú
              </h2>
              <p className="text-lg text-muted-foreground">
                Busca entre cientos de canchas sintéticas de fútbol, pádel y tenis disponibles en Lima y todo el país. Reserva en segundos en Tu Cancha.
              </p>
            </div>

            <div className="mx-auto max-w-4xl bg-background rounded-2xl border border-border shadow-xl p-6 md:p-8">
              <PublicSearchForm />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 border-t border-border/40">
          <PricingSection />
        </section>

        {/* FAQ Section */}
        <FaqSection />

        {/* Testimonials Section */}
        <section className="bg-muted/30 py-20 border-t border-border/40">
          <TestimonialsSection />
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground">
          {/* Background shapes */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom_right,_var(--tw-gradient-stops))] from-primary via-emerald-800 to-teal-950" />
          <div className="absolute top-0 right-0 -z-10 h-[300px] w-[300px] rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 -z-10 h-[300px] w-[300px] rounded-full bg-teal-500/20 blur-3xl" />
          
          <div className="container relative">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                Lleva la gestión de tu club al siguiente nivel
              </h2>
              <p className="text-lg text-emerald-100/90 max-w-xl mx-auto leading-relaxed">
                Únete a la comunidad de {process.env.NEXT_PUBLIC_APP_NAME} y comienza a digitalizar tus reservas con la prueba gratuita de 30 días.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:gap-4 sm:flex-row pt-4 max-w-md sm:max-w-none mx-auto">
                <Link href="/register?type=club" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto h-12 px-6 text-base gap-2 rounded-xl shadow-lg transition-all hover:bg-background hover:-translate-y-0.5">
                    Registrar mi Club
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-6 text-base gap-2 rounded-xl bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 hover:border-primary-foreground hover:-translate-y-0.5">
                    Crear Cuenta Personal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SEO Information & Popular Searches Section */}
        <section className="py-16 bg-muted/20 border-t border-border/40">
          <div className="container space-y-10 px-4 sm:px-6">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Tu Cancha: La plataforma para reservar canchas deportivas en Perú
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                En <strong>Tu Cancha</strong> conectamos a deportistas apasionados con los mejores complejos y clubes deportivos en Lima y todo el Perú. Olvídate de llamar por teléfono o esperar confirmaciones por mensajes: consulta la disponibilidad en tiempo real, compara tarifas y reserva tu cancha sintética al instante con Yape, Plin o tarjeta.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="p-5 rounded-2xl bg-background border border-border/60 shadow-sm space-y-2">
                <h3 className="text-base font-semibold text-foreground">Canchas de Fútbol y Sintéticas</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Reserva canchas de fútbol 5, fútbol 7 y fútbol 11 con pasto sintético de alta calidad, iluminación LED nocturna y vestuarios completos en tu distrito.
                </p>
                <div className="pt-2">
                  <Link href="/search?sport=futbol" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    Ver canchas de fútbol <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background border border-border/60 shadow-sm space-y-2">
                <h3 className="text-base font-semibold text-foreground">Canchas de Pádel y Tenis</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Encuentra pistas panorámicas de pádel y canchas de tenis con superficie de arcilla o pista rápida. Reserva horarios estelares con anticipación.
                </p>
                <div className="pt-2">
                  <Link href="/search?sport=padel" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    Ver pistas de pádel <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-background border border-border/60 shadow-sm space-y-2">
                <h3 className="text-base font-semibold text-foreground">Gestión Digital para Clubes</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Si administras un club o complejo deportivo, publica tus canchas en Tu Cancha. Gestiona reservas manuales, calendarios automáticos y cobra sin comisiones por Yape y Plin.
                </p>
                <div className="pt-2">
                  <Link href="/register?type=club" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                    Probar 30 días gratis <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Popular search tags for crawlers */}
            <div className="pt-4 border-t border-border/40">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Búsquedas populares en Perú
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { label: "Canchas de Fútbol en Lima", href: "/search?sport=futbol" },
                  { label: "Pádel en Lima", href: "/search?sport=padel" },
                  { label: "Canchas Sintéticas Fútbol 7", href: "/search?sport=futbol" },
                  { label: "Canchas de Tenis Perú", href: "/search?sport=tenis" },
                  { label: "Canchas de Vóley", href: "/search?sport=voley" },
                  { label: "Alquiler de Canchas Surco", href: "/search" },
                  { label: "Canchas San Borja", href: "/search" },
                  { label: "Canchas Los Olivos", href: "/search" },
                  { label: "Canchas Miraflores", href: "/search" },
                  { label: "Tu Cancha Reservas", href: "/search" },
                ].map((tag) => (
                  <Link
                    key={tag.label}
                    href={tag.href}
                    className="px-3 py-1.5 rounded-lg bg-background border border-border hover:border-primary/50 hover:text-primary transition-colors text-muted-foreground"
                  >
                    {tag.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12 sm:py-16">
        <div className="container px-4 sm:px-6">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
            {/* Logo + descripción */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={20}
                    height={20}
                  />
                </div>
                <span className="text-lg font-bold tracking-tight text-foreground">
                  {process.env.NEXT_PUBLIC_APP_NAME}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                La plataforma líder para la reserva y gestión de canchas deportivas. Generando confianza para clubes y deportistas.
              </p>
            </div>

            {/* Contáctanos */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Contáctanos</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5 transition-colors hover:text-foreground">
                  <Mail className="w-4.5 h-4.5 text-primary" />
                  Tucancha100@gmail.com
                </li>
                <li className="flex items-center gap-2.5 transition-colors hover:text-foreground">
                  <Phone className="w-4.5 h-4.5 text-primary" />
                  <a href="https://wa.me/51959493759" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    +51 959 493 759
                  </a>
                </li>
              </ul>
            </div>

            {/* Redes Sociales y Legal */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Síguenos</h3>
              <div className="flex items-center gap-4 text-muted-foreground">
                <Link href="https://www.facebook.com/profile.php?id=61576892022177" target="_blank" aria-label="Facebook" className="p-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </Link>
                <Link href="https://www.instagram.com/tucancha.pe?igsh=cGQyZjdvdmg0bjRp&utm_source=qr" target="_blank" aria-label="Instagram" className="p-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </Link>
                <Link href="https://wa.me/51959493759" target="_blank" aria-label="WhatsApp" className="p-2 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                  <MessageSquare className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Enlaces Legales y Configuración de Cookies */}
          <div className="mt-12 border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link href="/terminos" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Términos y Condiciones
              </Link>
              <Link href="/privacidad" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Política de Privacidad
              </Link>
              <Link href="/cookies" className="hover:text-foreground transition-colors underline-offset-4 hover:underline">
                Política de Cookies
              </Link>
              <CookieTriggerButton />
            </div>

            <div>
              &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
