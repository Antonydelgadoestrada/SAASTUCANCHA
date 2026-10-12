import React from 'react'

export function JsonLd() {
  const baseUrl = 'https://tucancha.com.pe'

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Tu Cancha',
    alternateName: ['TuCancha', 'Tu Cancha Perú', 'tucancha.com.pe'],
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Tu Cancha',
    alternateName: 'TuCancha',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    image: `${baseUrl}/general.jpeg`,
    description:
      'Tu Cancha es la plataforma digital líder en el Perú para encontrar, reservar y gestionar canchas deportivas y sintéticas en tiempo real.',
    email: 'Tucancha100@gmail.com',
    telephone: '+51-959-493-759',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+51-959-493-759',
        contactType: 'customer support',
        areaServed: 'PE',
        availableLanguage: ['es'],
      },
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lima',
      addressRegion: 'Lima',
      addressCountry: 'PE',
    },
    sameAs: [
      'https://www.facebook.com/profile.php?id=61576892022177',
      'https://www.instagram.com/tucancha.pe?igsh=cGQyZjdvdmg0bjRp&utm_source=qr',
      'https://wa.me/51959493759',
    ],
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Cómo reservar una cancha deportiva en Tu Cancha?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ingresa a Tu Cancha (tucancha.com.pe), selecciona tu deporte preferido (fútbol, pádel, tenis, vóley), tu distrito o ubicación y la fecha deseada. Elige el horario disponible y confirma tu reserva en segundos.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Qué métodos de pago acepta Tu Cancha?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Puedes pagar de forma rápida y segura con Yape, Plin y tarjetas de crédito o débito mediante pasarela de pago como Mercado Pago.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Cómo puedo registrar mi club o complejo deportivo en Tu Cancha?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Puedes registrar tu club haciendo clic en "Registra tu Club" en Tu Cancha. Dispones de 30 días de prueba gratuita sin compromiso para digitalizar tus canchas y recibir reservas online.',
        },
      },
      {
        '@type': 'Question',
        name: '¿En qué ciudades de Perú está disponible Tu Cancha?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tu Cancha está disponible en todo el Perú, cubriendo los principales distritos de Lima y provincias para alquiler de canchas sintéticas y campos deportivos.',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
