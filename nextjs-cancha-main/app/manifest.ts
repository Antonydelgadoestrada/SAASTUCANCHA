import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tu Cancha - Reserva de Canchas Deportivas en Perú',
    short_name: 'TuCancha',
    description: 'Encuentra y reserva canchas sintéticas de fútbol, pádel, tenis y vóley en tiempo real en todo el Perú.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#059669',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
