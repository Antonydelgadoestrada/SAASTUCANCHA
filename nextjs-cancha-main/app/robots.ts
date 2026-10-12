import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://tucancha.com.pe'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/search',
          '/login',
          '/register',
          '/terminos',
          '/privacidad',
          '/cookies',
        ],
        disallow: [
          '/admin/',
          '/club/',
          '/user/',
          '/api/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
