"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AwardIcon,
  GiftIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  Loader2Icon,
  Building2Icon,
  ArrowRightIcon,
  HistoryIcon,
  CalendarIcon,
  FlameIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getUserLoyaltyBalance,
  getUserLoyaltyRewards,
  getUserLoyaltyRedemptions,
  getUserLoyaltyTransactions,
  redeemUserLoyaltyReward,
  LoyaltyReward,
  LoyaltyRedemption,
  LoyaltyRedemptionStatus,
  LoyaltyTransaction,
} from "@/lib/loyalty";
import { getAllClubs } from "@/lib/club";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function UserLoyaltyContent() {
  const queryClient = useQueryClient();

  // 1. OBTENER LISTA DE CLUBES
  const { data: clubs, isLoading: isLoadingClubs } = useQuery({
    queryKey: ["all-clubs"],
    queryFn: getAllClubs,
  });

  const activeClubs = useMemo(() => {
    return Array.isArray(clubs)
      ? clubs.filter((c: any) => c.status === "APPROVED" || !c.status)
      : [];
  }, [clubs]);

  const [selectedClubId, setSelectedClubId] = useState<string>("");

  // Auto-seleccionar primer club disponible
  const currentClubId = selectedClubId || (activeClubs[0]?.id as string) || "";
  const currentClub = activeClubs.find((c: any) => c.id === currentClubId);

  // 2. OBTENER SALDO DEL USUARIO EN ESTE CLUB
  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ["user-loyalty-balance", currentClubId],
    queryFn: () => getUserLoyaltyBalance(currentClubId),
    enabled: Boolean(currentClubId),
  });

  const balance = balanceData?.balance || 0;
  const reservationsCount = balanceData?.paidReservationsCount || 0;

  // 3. OBTENER CATÁLOGO DE PREMIOS ACTIVOS
  const { data: rewards, isLoading: isLoadingRewards } = useQuery({
    queryKey: ["user-loyalty-rewards", currentClubId],
    queryFn: () => getUserLoyaltyRewards(currentClubId),
    enabled: Boolean(currentClubId),
  });

  // 4. OBTENER HISTORIAL DE CANJES DEL USUARIO
  const { data: redemptions, isLoading: isLoadingRedemptions } = useQuery({
    queryKey: ["user-loyalty-redemptions", currentClubId],
    queryFn: () => getUserLoyaltyRedemptions(currentClubId),
    enabled: Boolean(currentClubId),
  });

  // 5. OBTENER HISTORIAL DE TRANSACCIONES
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["user-loyalty-transactions", currentClubId],
    queryFn: () => getUserLoyaltyTransactions(currentClubId, 50),
    enabled: Boolean(currentClubId),
  });

  // =========================================================================
  // MODALES DE CANJE
  // =========================================================================
  const [confirmReward, setConfirmReward] = useState<LoyaltyReward | null>(null);
  const [successRedemption, setSuccessRedemption] =
    useState<LoyaltyRedemption | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const redeemMutation = useMutation({
    mutationFn: ({
      clubId,
      rewardId,
    }: {
      clubId: string;
      rewardId: string;
    }) => redeemUserLoyaltyReward(clubId, rewardId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["user-loyalty-balance", currentClubId],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-loyalty-redemptions", currentClubId],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-loyalty-transactions", currentClubId],
      });
      setConfirmReward(null);
      setSuccessRedemption(data.redemption);
      toast.success("¡Canje solicitado con éxito!");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "No se pudo procesar el canje"
      );
    },
  });

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("Código copiado al portapapeles");
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const getStatusBadge = (status: LoyaltyRedemptionStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 font-medium"
          >
            <ClockIcon className="w-3 h-3 mr-1" /> Por Retirar
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium"
          >
            <CheckCircle2Icon className="w-3 h-3 mr-1" /> Entregado
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge
            variant="outline"
            className="bg-red-500/10 text-red-600 border-red-500/30 font-medium"
          >
            <XCircleIcon className="w-3 h-3 mr-1" /> Rechazado
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge
            variant="outline"
            className="bg-slate-500/10 text-slate-500 border-slate-500/30 font-medium"
          >
            <AlertCircleIcon className="w-3 h-3 mr-1" /> Expirado
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* SELECTOR DE CLUB & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <AwardIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Mis Puntos de Fidelidad
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Revisa tus puntos acumulados por reservas y canjéalos por premios exclusivos en cada club.
          </p>
        </div>

        {/* SELECTOR DE SEDE / CLUB */}
        <div className="flex items-center gap-2">
          <Building2Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select
            value={currentClubId}
            onValueChange={(val) => setSelectedClubId(val)}
          >
            <SelectTrigger className="w-64 bg-background">
              <SelectValue placeholder="Selecciona un club" />
            </SelectTrigger>
            <SelectContent>
              {activeClubs.map((club: any) => (
                <SelectItem key={club.id} value={club.id}>
                  {club.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TARJETA DE BALANCE PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Puntos Disponibles */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-sm md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5 text-primary" /> Club {currentClub?.name || "Seleccionado"}
              </span>
              <Badge variant="secondary" className="font-mono text-xs">
                {reservationsCount} {reservationsCount === 1 ? "reserva pagada" : "reservas pagadas"}
              </Badge>
            </div>
            <CardTitle className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight pt-1">
              {isLoadingBalance ? (
                <Skeleton className="h-10 w-28" />
              ) : (
                <span className="flex items-baseline gap-2">
                  <span className="text-primary font-mono">{balance}</span>
                  <span className="text-lg font-semibold text-muted-foreground">
                    puntos disponibles
                  </span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Ganas puntos automáticamente con cada reserva 100% pagada en este club (vía online, saldo o caja).
            </p>
          </CardContent>
        </Card>

        {/* Canjes Activos Pendientes */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GiftIcon className="w-4 h-4 text-primary" />
              Canjes por Retirar
            </CardTitle>
            <CardDescription className="text-xs">
              Premios solicitados listos para reclamar en el club.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRedemptions ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold font-mono">
                {redemptions?.filter((r) => r.status === "PENDING").length || 0}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 text-xs text-muted-foreground">
            Muestra el código al personal de recepción.
          </CardFooter>
        </Card>
      </div>

      {/* PESTAÑAS: PREMIOS / MIS CANJES / HISTORIAL */}
      <Tabs defaultValue="catalog" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/60">
          <TabsTrigger value="catalog" className="gap-1.5 text-xs sm:text-sm">
            <GiftIcon className="w-4 h-4" /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="my-redemptions" className="gap-1.5 text-xs sm:text-sm">
            <ClockIcon className="w-4 h-4" /> Mis Canjes
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <HistoryIcon className="w-4 h-4" /> Movimientos
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* PESTAÑA 1: CATÁLOGO DE PREMIOS */}
        {/* ================================================================= */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Premios Disponibles en {currentClub?.name || "este Club"}
            </h2>
          </div>

          {isLoadingRewards ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : !rewards || rewards.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <GiftIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
                <p className="font-semibold text-base">
                  Este club aún no ha publicado premios en su catálogo
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Pronto podrás canjear bebidas, indumentaria y horas de alquiler con tus puntos acumulados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => {
                const canAfford = balance >= reward.pointsCost;
                return (
                  <Card
                    key={reward.id}
                    className={`flex flex-col justify-between transition-all hover:shadow-md ${
                      !canAfford ? "opacity-80" : ""
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-semibold">
                          {reward.name}
                        </CardTitle>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary font-mono text-xs font-bold shrink-0"
                        >
                          <SparklesIcon className="w-3 h-3 mr-1" />
                          {reward.pointsCost} pts
                        </Badge>
                      </div>
                      {reward.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {reward.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardFooter className="pt-2 border-t flex items-center justify-between">
                      {canAfford ? (
                        <Button
                          size="sm"
                          className="w-full font-semibold"
                          onClick={() => setConfirmReward(reward)}
                        >
                          Canjear Premio
                          <ArrowRightIcon className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      ) : (
                        <div className="w-full text-center py-1.5 px-3 rounded-lg bg-muted text-[11px] text-muted-foreground">
                          Te faltan {reward.pointsCost - balance} pts
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ================================================================= */}
        {/* PESTAÑA 2: MIS CANJES (CÓDIGOS PARA RECLAMAR) */}
        {/* ================================================================= */}
        <TabsContent value="my-redemptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Mis Canjes Solicitados</h2>
          </div>

          {isLoadingRedemptions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : !redemptions || redemptions.length === 0 ? (
            <Card className="text-center py-10 border-dashed">
              <CardContent className="space-y-2">
                <ClockIcon className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                <p className="font-semibold text-sm">Aún no has solicitado canjes en este club</p>
                <p className="text-xs text-muted-foreground">
                  Explora el catálogo y canjea tus puntos cuando alcances el saldo requerido.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {redemptions.map((red) => (
                <Card key={red.id} className="p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">
                          {red.rewardNameSnapshot}
                        </span>
                        {getStatusBadge(red.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Costo: <strong className="text-foreground">{red.rewardCostSnapshot} pts</strong>
                        {" • "}Solicitado el:{" "}
                        {format(new Date(red.requestedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                      {red.status === "REJECTED" && red.rejectReason && (
                        <p className="text-xs text-red-500 font-medium">
                          Motivo rechazo: {red.rejectReason} (Puntos reembolsados)
                        </p>
                      )}
                    </div>

                    {/* CÓDIGO DESTACADO */}
                    <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border shrink-0">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold block uppercase">
                          Código de Canje
                        </span>
                        <span className="font-mono text-lg font-bold text-primary tracking-wider">
                          {red.code}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleCopyCode(red.code)}
                        title="Copiar código"
                      >
                        {copiedCode === red.code ? (
                          <CheckIcon className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <CopyIcon className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================================================================= */}
        {/* PESTAÑA 3: HISTORIAL DE MOVIMIENTOS */}
        {/* ================================================================= */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Historial de Movimientos de Puntos</h2>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingTransactions ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No hay transacciones registradas todavía en este club.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Puntos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const isPositive = tx.points > 0;
                        const isZero = tx.points === 0;
                        return (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {tx.note || tx.type}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-sm">
                              {isZero ? (
                                <span className="text-muted-foreground">0</span>
                              ) : isPositive ? (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  +{tx.points}
                                </span>
                              ) : (
                                <span className="text-red-500">
                                  {tx.points}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================================= */}
      {/* MODAL 1: CONFIRMAR SOLICITUD DE CANJE */}
      {/* ================================================================= */}
      <Dialog
        open={Boolean(confirmReward)}
        onOpenChange={(open) => !open && setConfirmReward(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GiftIcon className="w-5 h-5 text-primary" /> Confirmar Canje de Premio
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de solicitar este premio? Se debitarán los puntos correspondientes de tu saldo.
            </DialogDescription>
          </DialogHeader>

          {confirmReward && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span>{confirmReward.name}</span>
                  <span className="font-mono text-primary font-bold">
                    -{confirmReward.pointsCost} pts
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t">
                  <span>Tu saldo actual:</span>
                  <span className="font-mono font-bold text-foreground">{balance} pts</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Saldo tras el canje:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {balance - confirmReward.pointsCost} pts
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Recibirás un código único para mostrar en la recepción o cafetería del club al momento de retirar tu premio.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReward(null)}>
              Cancelar
            </Button>
            <Button
              disabled={redeemMutation.isPending}
              onClick={() => {
                if (confirmReward && currentClubId) {
                  redeemMutation.mutate({
                    clubId: currentClubId,
                    rewardId: confirmReward.id,
                  });
                }
              }}
            >
              {redeemMutation.isPending && (
                <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
              )}
              Confirmar Canje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* MODAL 2: CANJE EXITOSO CON CÓDIGO DESTACADO */}
      {/* ================================================================= */}
      <Dialog
        open={Boolean(successRedemption)}
        onOpenChange={(open) => !open && setSuccessRedemption(null)}
      >
        <DialogContent className="sm:max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2Icon className="w-7 h-7" />
          </div>

          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-xl">¡Canje Realizado con Éxito!</DialogTitle>
            <DialogDescription className="text-xs">
              Muestra este código al personal del club al retirar tu premio:
            </DialogDescription>
          </DialogHeader>

          {successRedemption && (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {successRedemption.rewardNameSnapshot}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-primary tracking-widest">
                    {successRedemption.code}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 ml-1"
                    onClick={() => handleCopyCode(successRedemption.code)}
                  >
                    {copiedCode === successRedemption.code ? (
                      <CheckIcon className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <CopyIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Válido hasta:{" "}
                  {format(new Date(successRedemption.expiresAt), "dd/MM/yyyy", { locale: es })}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground text-left space-y-1">
                <p className="font-semibold text-foreground">¿Cómo reclamar tu premio?</p>
                <p>1. Acércate a la recepción o cafetería de {currentClub?.name}.</p>
                <p>2. Dicta o muestra el código alfanumérico arriba indicado.</p>
                <p>3. El personal validará el canje y te hará entrega de tu beneficio.</p>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full"
              onClick={() => setSuccessRedemption(null)}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
