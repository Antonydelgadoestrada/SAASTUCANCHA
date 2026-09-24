"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Menu, X, ArrowRight, Search, Trophy, Shield, HelpCircle, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const navLinks = [
  { href: "#features", label: "Características", icon: Trophy },
  { href: "#search", label: "Buscar Canchas", icon: Search },
  { href: "#pricing", label: "Precios", icon: DollarSign },
  { href: "#testimonials", label: "Seguridad", icon: Shield },
  { href: "/search", label: "Explorar Todo", icon: ArrowRight },
]

export function LandingNav() {
  const [activeSection, setActiveSection] = useState<string>("")
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const sections = navLinks
        .filter((l) => l.href.startsWith("#"))
        .map((link) => link.href.substring(1))

      let current = ""
      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= 120 && rect.bottom >= 120) {
            current = section
            break
          }
        }
      }

      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex">
        <ul className="flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const isActive = link.href.startsWith("#") && activeSection === link.href.substring(1)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`text-sm font-medium transition-all px-3 py-1.5 rounded-lg border border-transparent ${
                    isActive
                      ? "text-primary border-primary/20 bg-primary/10 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Mobile Hamburger Menu Drawer */}
      <div className="flex md:hidden">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-xs flex flex-col justify-between p-6">
            <div className="space-y-6">
              <SheetHeader className="text-left pb-4 border-b border-border/50">
                <SheetTitle className="text-lg font-bold flex items-center gap-2">
                  <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
                    {process.env.NEXT_PUBLIC_APP_NAME || "TuCancha"}
                  </span>
                </SheetTitle>
              </SheetHeader>

              <nav className="space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const isActive = link.href.startsWith("#") && activeSection === link.href.substring(1)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="pt-6 border-t border-border/50 space-y-3">
              <Link href="/register?type=club" onClick={() => setIsMobileOpen(false)} className="w-full block">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                  Registrar Club
                </Button>
              </Link>
              <Link href="/login" onClick={() => setIsMobileOpen(false)} className="w-full block">
                <Button variant="outline" className="w-full">
                  Iniciar Sesión
                </Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
