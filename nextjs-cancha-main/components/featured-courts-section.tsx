// Server Component: NO "use client"
import { FeaturedCourtsHome, type FeaturedCourt } from "@/components/featured-courts-home";
import { getLimit10Server } from "@/lib/server-api";

async function getFeaturedCourts(): Promise<FeaturedCourt[]> {
  try {
    const data = await getLimit10Server()
    return data.map((c: any) => ({
      id: c.id,
      name: c.name,
      venue: c.venue ? { id: c.venue.id, name: c.venue.name, address: c.venue.address } : undefined,
      images: c.images ?? (c.image ? [c.image] : []),
      priceDay: Number(c.priceDay),
      priceNight: Number(c.priceNight),
      promoDay: c.promoDay ?? null,
      promoNight: c.promoNight ?? null,
      rating: c.rating ?? null,
      reviews: c.reviews ?? null,
      href: `/court/${c.id}`,
    })) as FeaturedCourt[];
  } catch (error) {
    console.error('Error fetching featured courts:', error);
    return [];
  }
}

export default async function FeaturedCourtsSection() {
  const courts = await getFeaturedCourts();

  return (
   <section id="featured" className="py-16">
  <div className="container">
    <div className="mb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Campos destacados
          </h2>
          <p className="text-muted-foreground">
            Los campos más populares del momento.
          </p>
        </div>

        {/* Link en desktop/tablet: alineado a la derecha */}
        <a
          href="/search?featured=true"
          className="hidden sm:inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded px-1 py-0.5"
          aria-label="Ver todos los campos destacados"
        >
          Ver todos
        </a>
      </div>

      {/* Link en móvil: debajo del título, con mejor área táctil */}
      <a
        href="/search?featured=true"
        className="text-primary mt-3 inline-flex sm:hidden text-sm font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded px-1 py-1"
        aria-label="Ver todos los campos destacados"
      >
        Ver todos
      </a>
    </div>

    <FeaturedCourtsHome courts={courts} />
  </div>
</section>

  );
}
