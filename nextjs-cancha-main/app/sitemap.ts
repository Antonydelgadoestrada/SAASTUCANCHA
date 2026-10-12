import type { MetadataRoute } from 'next'
import { getAllClubsServer } from '@/lib/server-api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://tucancha.com.pe'
  const currentDate = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/register?type=club`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Add popular sports landing queries to boost search indexing
  const popularSportFilters = ['futbol', 'padel', 'tenis', 'voley', 'basquet']
  const sportRoutes: MetadataRoute.Sitemap = popularSportFilters.map((sport) => ({
    url: `${baseUrl}/search?sport=${sport}`,
    lastModified: currentDate,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  try {
    const clubs = await getAllClubsServer()
    const clubRoutes: MetadataRoute.Sitemap = Array.isArray(clubs)
      ? clubs
          .filter((club: any) => club?.id && club?.is_active !== false)
          .map((club: any) => ({
            url: `${baseUrl}/search?club=${club.id}`,
            lastModified: club.updated_at ? new Date(club.updated_at) : currentDate,
            changeFrequency: 'weekly',
            priority: 0.8,
          }))
      : []

    return [...staticRoutes, ...sportRoutes, ...clubRoutes]
  } catch (error) {
    console.error('Error generating dynamic club sitemap:', error)
    return [...staticRoutes, ...sportRoutes]
  }
}
