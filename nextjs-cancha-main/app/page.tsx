import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Calendar, CheckCircle, MapPin, Search, Shield, Star, Mail, Phone, Facebook, Instagram, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PublicSearchForm } from "@/components/public-search-form"
import { TestimonialsSection } from "@/components/testimonials-section"
import { PricingSection } from "@/components/pricing-section"
import { AuthHeaderButtons } from "@/components/AuthHeaderButtons"
import FeaturedCourtsSection from "@/components/featured-courts-section"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  return (
    // <div className="flex min-h-screen flex-col ">
    <div className="flex w-full min-h-screen flex-col ">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
          />
            <span className="text-xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME}</span>
          </div>
          <nav className="hidden md:flex">
            <ul className="flex items-center gap-6">
              <li>
                <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Características
                </Link>
              </li>
              <li>
                <Link href="#search" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Buscar Canchas
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Precios
                </Link>
              </li>
              <li>
                <Link href="#testimonials" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Testimonios
                </Link>
              </li>
            </ul>
          </nav>
          <div className="flex items-center gap-4">
            <AuthHeaderButtons/>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-background pb-16 pt-24">
          <div className="container relative z-10 grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="flex flex-col justify-center space-y-4">
              <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                La plataforma #1 para reserva de canchas deportivas
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Reserva canchas deportivas en segundos
              </h1>
              <p className="text-xl text-muted-foreground">
                Encuentra y reserva las mejores canchas deportivas cerca de ti. Fútbol, tenis, pádel y más.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="#search">
                  <Button size="lg" className="gap-2">
                    <Search className="h-4 w-4" />
                    Buscar Canchas
                  </Button>
                </Link>
                <Link href="/register?type=club">
                  <Button size="lg" variant="outline" className="gap-2">
                    Registra tu Club
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
             
            </div>
            <div className="relative hidden md:block">
              <div className="absolute inset-0 z-0 bg-gradient-radial from-primary/20 to-transparent" />
              <Image
                src="/general.jpeg?height=600&width=600&text=Canchas+Deportivas"
                alt="Canchas Deportivas"
                width={600}
                height={600}
                className="relative z-10 rounded-lg object-cover"
                priority
              />
            </div>
          </div>
        </section>

  {/* === Campos destacados === */}
         <FeaturedCourtsSection />
        {/* Features Section */}
        <section id="features" className="py-16">
          <div className="container">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Todo lo que necesitas para gestionar tus canchas deportivas
              </h2>
              <p className="text-lg text-muted-foreground">
                {process.env.NEXT_PUBLIC_APP_NAME} ofrece todas las herramientas que necesitas para administrar tus canchas deportivas de manera
                eficiente y aumentar tus ingresos.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Sistema de Reservas</h3>
                    <p className="text-muted-foreground">
                      Gestiona fácilmente las reservas de tus canchas con nuestro sistema intuitivo y automatizado.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Múltiples Sedes</h3>
                    <p className="text-muted-foreground">
                      Administra todas tus sedes desde un solo lugar, con control total sobre cada cancha.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Pagos Seguros</h3>
                    <p className="text-muted-foreground">
                      Recibe pagos de forma segura y automática, con múltiples opciones para tus clientes.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Promociones Especiales</h3>
                    <p className="text-muted-foreground">
                      Crea promociones y descuentos para atraer más clientes en horarios específicos.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Estadísticas Detalladas</h3>
                    <p className="text-muted-foreground">
                      Analiza el rendimiento de tus canchas con estadísticas detalladas y reportes personalizados.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <Search className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">Mayor Visibilidad</h3>
                    <p className="text-muted-foreground">
                      Aumenta la visibilidad de tus canchas y atrae nuevos clientes a través de nuestra plataforma.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Search Section */}
        <section id="search" className="bg-muted py-16">
          <div className="container">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Encuentra la cancha perfecta para tu deporte favorito
              </h2>
              <p className="text-lg text-muted-foreground">
                Busca entre cientos de canchas disponibles en tu zona y reserva en segundos.
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <PublicSearchForm />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16">
          <PricingSection />
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="bg-muted py-16">
          <TestimonialsSection />
        </section>

        {/* CTA Section */}
        <section className="bg-primary py-16 text-primary-foreground">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Únete a la comunidad de {process.env.NEXT_PUBLIC_APP_NAME}</h2>
              <p className="mb-8 text-lg">
                Registra tu club deportivo hoy y comienza a gestionar tus canchas de manera eficiente.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Link href="/register?type=club">
                  <Button size="lg" variant="secondary" className="gap-2">
                    Registrar mi Club
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="gap-2 bg-transparent text-primary-foreground">
                    Crear Cuenta Personal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-8">
      <div className="container">
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Logo + descripción */}
        <div>
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Logo"
              width={32}
              height={32}
            />
            <span className="text-xl font-bold">{process.env.NEXT_PUBLIC_APP_NAME}</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            La plataforma líder para la reserva y gestión de canchas deportivas.
          </p>
        </div>

        {/* Contáctanos */}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Contáctanos</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Tucancha100@gmail.com
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              +51 959 493 759
            </li>
          </ul>
        </div>

        {/* Redes Sociales */}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Síguenos</h3>
          <div className="flex items-center gap-4 text-muted-foreground">
            <Link href="https://www.facebook.com/profile.php?id=61576892022177" target="_blank" aria-label="Facebook">
              <Facebook className="h-5 w-5 hover:text-foreground" />
            </Link>
            <Link href="https://www.instagram.com/tucancha.pe?igsh=cGQyZjdvdmg0bjRp&utm_source=qr" target="_blank" aria-label="Instagram">
              <Instagram className="h-5 w-5 hover:text-foreground" />
            </Link>
            <Link href="https://wa.me/51959493759" target="_blank" aria-label="WhatsApp">
              <MessageSquare className="h-5 w-5 hover:text-foreground" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME}. Todos los derechos reservados.
      </div>
</div>
      </footer>
    </div>
  )
}
