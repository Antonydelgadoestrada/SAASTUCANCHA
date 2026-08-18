import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calendar, CheckCircle, MapPin, Search, Shield, Star, Mail, Phone, Facebook, Instagram, MessageSquare, Award, Clock, Users, ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PublicSearchForm } from "@/components/public-search-form"
import { TestimonialsSection } from "@/components/testimonials-section"
import { PricingSection } from "@/components/pricing-section"
import { AuthHeaderButtons } from "@/components/AuthHeaderButtons"
import FeaturedCourtsSection from "@/components/featured-courts-section"
import { FeaturesCarousel } from "@/components/features-carousel"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  return (
    <div className="flex w-full min-h-screen flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Image
                src="/logo.png"
                alt="Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              {process.env.NEXT_PUBLIC_APP_NAME}
            </span>
          </div>
          <nav className="hidden md:flex">
            <ul className="flex items-center gap-8">
              <li>
                <Link href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Características
                </Link>
              </li>
              <li>
                <Link href="#search" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Buscar Canchas
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="#testimonials" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                  Preguntas Frecuentes
                </Link>
              </li>
            </ul>
          </nav>
          <div className="flex items-center gap-4">
            <AuthHeaderButtons />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 lg:pt-32 lg:pb-32 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
          <div className="absolute inset-y-0 right-0 -z-10 w-full max-w-5xl bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent blur-3xl" />
          
          <div className="container grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col justify-center space-y-6 lg:col-span-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
                <Award className="h-4 w-4" />
                La plataforma #1 para reserva de canchas deportivas
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Reserva canchas deportivas{" "}
                <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-600 bg-clip-text text-transparent">
                  en segundos
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                Encuentra, compara y reserva las mejores canchas deportivas cerca de ti en tiempo real. Fútbol, tenis, pádel, voley y mucho más.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row pt-2">
                <Link href="#search">
                  <Button size="lg" className="h-12 px-6 text-base gap-2 rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                    <Search className="h-5 w-5" />
                    Buscar Canchas
                  </Button>
                </Link>
                <Link href="/register?type=club">
                  <Button size="lg" variant="outline" className="h-12 px-6 text-base gap-2 rounded-xl transition-all hover:bg-muted hover:-translate-y-0.5">
                    Registra tu Club
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {/* Stats / Trust Badges */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-border/40">
                <div className="space-y-1">
                  <h4 className="text-3xl font-extrabold tracking-tight text-foreground">+50K</h4>
                  <p className="text-sm text-muted-foreground font-medium">Reservas procesadas</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-3xl font-extrabold tracking-tight text-foreground">99.9%</h4>
                  <p className="text-sm text-muted-foreground font-medium">Puntualidad de acceso</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-3xl font-extrabold tracking-tight text-foreground">+100</h4>
                  <p className="text-sm text-muted-foreground font-medium">Clubes asociados</p>
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
                    alt="Canchas Deportivas Premium"
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

        {/* Featured Courts Section */}
        <section className="py-20 border-t border-border/40 bg-muted/30">
          <FeaturedCourtsSection />
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
                Encuentra la cancha perfecta para tu deporte favorito
              </h2>
              <p className="text-lg text-muted-foreground">
                Busca entre cientos de canchas disponibles en tu zona y reserva en segundos de forma segura.
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

        {/* Testimonials Section */}
        <section id="testimonials" className="bg-muted/30 py-20 border-t border-border/40">
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
              <div className="flex flex-col justify-center gap-4 sm:flex-row pt-4">
                <Link href="/register?type=club">
                  <Button size="lg" variant="secondary" className="h-12 px-6 text-base gap-2 rounded-xl shadow-lg transition-all hover:bg-background hover:-translate-y-0.5">
                    Registrar mi Club
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="h-12 px-6 text-base gap-2 rounded-xl bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 hover:border-primary-foreground hover:-translate-y-0.5">
                    Crear Cuenta Personal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-16">
        <div className="container">
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

            {/* Redes Sociales */}
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

          <div className="mt-12 border-t pt-8 text-center text-xs text-muted-foreground/80">
            &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
