"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const navLinks = [
  { href: "#features", label: "Características" },
  { href: "#search", label: "Buscar Canchas" },
  { href: "#pricing", label: "Precios" },
  { href: "#testimonials", label: "Seguridad" },
  { href: "#faq", label: "Preguntas Frecuentes" },
]

export function LandingNav() {
  const [activeSection, setActiveSection] = useState<string>("")

  useEffect(() => {
    const handleScroll = () => {
      const sections = navLinks.map(link => link.href.substring(1))
      
      let current = ""
      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const rect = element.getBoundingClientRect()
          // If the section's top is near the top of the viewport (with some offset)
          if (rect.top <= 100 && rect.bottom >= 100) {
            current = section
            break
          }
        }
      }
      
      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // Initial check
    handleScroll()
    
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav className="hidden md:flex">
      <ul className="flex items-center gap-6">
        {navLinks.map((link) => (
          <li key={link.href}>
            <Link 
              href={link.href} 
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg border border-transparent ${
                activeSection === link.href.substring(1)
                  ? "text-primary border-primary bg-primary/5" 
                  : "text-muted-foreground hover:text-primary hover:bg-muted"
              }`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
