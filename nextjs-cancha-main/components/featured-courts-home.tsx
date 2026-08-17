"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Link from "next/link";

export type FeaturedCourt = {
  id: string;
  name: string;
  images?: string[];
  image?: string;
  priceDay: number;
  priceNight: number;
  promoDay?: string | number | null;
  promoNight?: string | number | null;
  time?: string | number;
  venue?: { id?: number; name?: string; address?: string };
};

const formatSoles = (n?: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? `S/ ${n.toLocaleString("es-PE", {
        minimumFractionDigits: n % 1 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`
    : "-";

const toNum = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const hasPromo = (base?: number, promo?: number) =>
  typeof base === "number" && typeof promo === "number" && promo > 0 && promo < base;

const formatDuration = (t?: number) => {
  if (!t || t === 1) return "hora";
  if (t === 0.5) return "media hora";
  if (t === 1.5) return "hora y media";
  return `${t} horas`;
};

export function FeaturedCourtsHome({ courts }: { courts: FeaturedCourt[] }) {
  if (!courts?.length) {
    return <div className="text-center text-sm text-muted-foreground">Aún no hay campos destacados.</div>;
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {courts.map((court) => {
          // unitarios del backend
          const priceDayUnit = toNum(court.priceDay)!;
          const priceNightUnit = toNum(court.priceNight)!;
          const promoDayUnit = toNum(court.promoDay);
          const promoNightUnit = toNum(court.promoNight);

          // multiplicador total = time × 2
          const timeVal = toNum(court.time) ?? 1;
          const multiplier = timeVal * 2;
          const durationLabel = formatDuration(timeVal);

          // promos válidas a nivel unitario
          const promoDayValid = hasPromo(priceDayUnit, promoDayUnit);
          const promoNightValid = hasPromo(priceNightUnit, promoNightUnit);
          const showAnyPromo = promoDayValid || promoNightValid;

          // totales mostrados
          const dayBaseTotal = priceDayUnit * multiplier;
          const dayPromoTotal = promoDayUnit ? promoDayUnit * multiplier : undefined;

          const nightBaseTotal = priceNightUnit * multiplier;
          const nightPromoTotal = promoNightUnit ? promoNightUnit * multiplier : undefined;
           const query = encodeURIComponent(court.name); // por si tiene espacios

          return (
            <CarouselItem key={court.id} className="basis-full md:basis-1/2 lg:basis-1/3">
              <Link href={`/search?query=${query}`} className="block h-full">
                <Card className="overflow-hidden h-full">
                  {/* Imagen + cinta de descuento (sin rotación, no se corta) */}
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={court.images?.[0] || court.image || "/placeholder.svg"}
                      alt={court.name}
                      width={600}
                      height={338}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    {showAnyPromo && (
                      <Badge className="absolute left-2 top-2 bg-red-600 text-white shadow">
                        DESCUENTO
                      </Badge>
                    )}
                  </div>

                  {/* Nombre + ubicación al lado */}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="line-clamp-1">{court.name}</CardTitle>
                        {court.venue?.name && (
                          <CardDescription className="line-clamp-1">{court.venue.name}</CardDescription>
                        )}
                      </div>

                      {court.venue?.address && (
                        <div className="hidden sm:flex items-start gap-1 text-xs text-muted-foreground max-w-[50%]">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          <span className="line-clamp-2">{court.venue.address}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Ubicación para móviles */}
                    {court.venue?.address && (
                      <div className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-2">{court.venue.address}</span>
                      </div>
                    )}

                    {/* Precios Día / Noche (totales: unit × time × 2) */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Día */}
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Día</span>
                          <span className="text-xs text-muted-foreground text-right truncate">
                            por {durationLabel}
                          </span>
                        </div>

                        {/* precios alineados debajo de la unidad */}
                        {promoDayValid ? (
                          <div className="mt-1">
                            <div className="text-xs line-through text-muted-foreground">
                              {formatSoles(dayBaseTotal)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <div className="text-lg font-semibold text-primary">
                                {formatSoles(dayPromoTotal)}
                              </div>
                              {/* <Badge variant="outline" className="text-[10px]">Promoción</Badge> */}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-lg font-semibold">
                            {formatSoles(dayBaseTotal)}
                          </div>
                        )}
                      </div>

                      {/* Noche */}
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Noche</span>
                          <span className="text-xs text-muted-foreground text-right truncate">
                            por {durationLabel}
                          </span>
                        </div>

                        {promoNightValid ? (
                          <div className="mt-1">
                            <div className="text-xs line-through text-muted-foreground">
                              {formatSoles(nightBaseTotal)}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <div className="text-lg font-semibold text-primary">
                                {formatSoles(nightPromoTotal)}
                              </div>
                              {/* <Badge variant="outline" className="text-[10px]">Promoción</Badge> */}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-lg font-semibold">
                            {formatSoles(nightBaseTotal)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="gap-2">{/* sin botones, solo lo pedido */}</CardFooter>
                </Card>
              </Link>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
