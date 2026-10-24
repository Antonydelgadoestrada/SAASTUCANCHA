"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AwardIcon,
  GiftIcon,
  SettingsIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  SearchIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  AlertCircleIcon,
  Loader2Icon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  FilterIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getClubLoyaltyConfig,
  updateClubLoyaltyConfig,
  getClubLoyaltyRewards,
  createClubLoyaltyReward,
  updateClubLoyaltyReward,
  deleteClubLoyaltyReward,
  getClubLoyaltyRedemptions,
  deliverClubLoyaltyReward,
  rejectClubLoyaltyRedemption,
  LoyaltyConfig,
  LoyaltyReward,
  LoyaltyRedemption,
  LoyaltyRedemptionStatus,
  UpdateLoyaltyConfigDto,
} from "@/lib/loyalty";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LoyaltyContent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("redeem-desk");

  // =========================================================================
  // 1. DATA QUERIES
  // =========================================================================
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["club-loyalty-config"],
    queryFn: getClubLoyaltyConfig,
  });

  const { data: rewards, isLoading: isLoadingRewards } = useQuery({
    queryKey: ["club-loyalty-rewards"],
    queryFn: getClubLoyaltyRewards,
  });

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data: redemptions, isLoading: isLoadingRedemptions } = useQuery({
    queryKey: ["club-loyalty-redemptions", statusFilter],
    queryFn: () =>
      getClubLoyaltyRedemptions(
        statusFilter === "ALL"
          ? undefined
          : (statusFilter as LoyaltyRedemptionStatus)
      ),
  });

  // Query global de canjes para badges informativos y métricas rápidas
  const { data: allRedemptions = [] } = useQuery({
    queryKey: ["club-loyalty-redemptions", "ALL_OVERVIEW"],
    queryFn: () => getClubLoyaltyRedemptions(),
  });

  const pendingRedemptions = allRedemptions.filter((r) => r.status === "PENDING");
  const deliveredRedemptions = allRedemptions.filter((r) => r.status === "DELIVERED");
  const totalRedemptionsCount = allRedemptions.length;
  const totalPointsRedeemed = deliveredRedemptions.reduce(
    (sum, r) => sum + (r.rewardCostSnapshot || 0),
    0
  );

  // =========================================================================
  // 2. CONFIGURATION FORM STATE
  // =========================================================================
  const [configForm, setConfigForm] = useState<UpdateLoyaltyConfigDto | null>(null);

  // Sync config form once loaded
  const currentConfig: LoyaltyConfig = configForm
    ? ({ ...config, ...configForm } as LoyaltyConfig)
    : config || {
        id: "",
        clubId: "",
        isActive: false,
        mode: "A",
        dayPoints: 10,
        nightPoints: 15,
        nightStartsAt: "18:00",
        bonusEveryX: 5,
        bonusPoints: 50,
        createdAt: "",
        updatedAt: "",
      };

  const updateConfigMutation = useMutation({
    mutationFn: updateClubLoyaltyConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["club-loyalty-config"], updated);
      toast.success("Configuración de fidelidad guardada exitosamente");
      setConfigForm(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Error al guardar la configuración"
      );
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate({
      isActive: currentConfig.isActive,
      mode: currentConfig.mode,
      dayPoints: Number(currentConfig.dayPoints) || 0,
      nightPoints: Number(currentConfig.nightPoints) || 0,
      nightStartsAt: currentConfig.nightStartsAt || "18:00",
      bonusEveryX: Number(currentConfig.bonusEveryX) || 1,
      bonusPoints: Number(currentConfig.bonusPoints) || 0,
    });
  };

  // =========================================================================
  // 3. REWARD MANAGEMENT MODAL (CREATE / EDIT)
  // =========================================================================
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: "",
    description: "",
    pointsCost: 50,
    isActive: true,
  });

  const openCreateReward = () => {
    setEditingReward(null);
    setRewardForm({
      name: "",
      description: "",
      pointsCost: 50,
      isActive: true,
    });
    setIsRewardModalOpen(true);
  };

  const openEditReward = (reward: LoyaltyReward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description || "",
      pointsCost: reward.pointsCost,
      isActive: reward.isActive,
    });
    setIsRewardModalOpen(true);
  };

  const saveRewardMutation = useMutation({
    mutationFn: async () => {
      if (editingReward) {
        return await updateClubLoyaltyReward(editingReward.id, rewardForm);
      } else {
        return await createClubLoyaltyReward(rewardForm);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-loyalty-rewards"] });
      toast.success(
        editingReward ? "Premio actualizado" : "Nuevo premio creado"
      );
      setIsRewardModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Error al procesar el premio"
      );
    },
  });

  const deleteRewardMutation = useMutation({
    mutationFn: deleteClubLoyaltyReward,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-loyalty-rewards"] });
      toast.success("Premio desactivado exitosamente");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Error al desactivar premio"
      );
    },
  });

  // =========================================================================
  // 4. VALIDATION & REDEMPTION DESK STATE
  // =========================================================================
  const [searchCode, setSearchCode] = useState("");
  const [foundRedemption, setFoundRedemption] = useState<LoyaltyRedemption | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);

  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingRedemptionId, setRejectingRedemptionId] = useState<string | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");

  const handleSearchCode = () => {
    const codeToSearch = searchCode.trim().toUpperCase();
    if (!codeToSearch) {
      toast.error("Por favor ingresa un código de canje");
      return;
    }

    setIsSearching(true);
    // Find directly in redemptions or query
    const match = redemptions?.find(
      (r) => r.code.toUpperCase() === codeToSearch
    );

    if (match) {
      setFoundRedemption(match);
      setIsSearching(false);
    } else {
      // Refresh list to find latest
      getClubLoyaltyRedemptions()
        .then((all) => {
          const freshMatch = all.find(
            (r) => r.code.toUpperCase() === codeToSearch
          );
          if (freshMatch) {
            setFoundRedemption(freshMatch);
          } else {
            setFoundRedemption(null);
            toast.error(`Código "${codeToSearch}" no encontrado en este club`);
          }
        })
        .catch(() => {
          toast.error("Error al buscar el código de canje");
        })
        .finally(() => setIsSearching(false));
    }
  };

  const deliverMutation = useMutation({
    mutationFn: deliverClubLoyaltyReward,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["club-loyalty-redemptions"] });
      setFoundRedemption(updated);
      toast.success("¡Premio entregado exitosamente al usuario!");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "No se pudo entregar el premio"
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectClubLoyaltyRedemption(id, reason),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["club-loyalty-redemptions"] });
      if (foundRedemption && foundRedemption.id === updated.id) {
        setFoundRedemption(updated);
      }
      toast.success("Canje rechazado y puntos reembolsados al usuario");
      setIsRejectModalOpen(false);
      setRejectReason("");
      setRejectingRedemptionId(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Error al rechazar el canje"
      );
    },
  });

  const handleOpenReject = (redemptionId: string) => {
    setRejectingRedemptionId(redemptionId);
    setRejectReason("");
    setIsRejectModalOpen(true);
  };

  const getStatusBadge = (status: LoyaltyRedemptionStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 font-medium">
            <ClockIcon className="w-3 h-3 mr-1" /> Pendiente de Entrega
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium">
            <CheckCircle2Icon className="w-3 h-3 mr-1" /> Entregado
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 font-medium">
            <XCircleIcon className="w-3 h-3 mr-1" /> Rechazado
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/30 font-medium">
            <AlertCircleIcon className="w-3 h-3 mr-1" /> Expirado
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full pb-16">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <AwardIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Programa de Puntos y Fidelidad
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fideliza a tus jugadores premiando sus reservas recurrentes en tu club.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border self-start md:self-auto">
          <span className="text-sm font-medium">
            Estado del Programa:
          </span>
          <Badge
            variant={currentConfig.isActive ? "default" : "secondary"}
            className={
              currentConfig.isActive
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }
          >
            {currentConfig.isActive ? "Activo" : "Pausado"}
          </Badge>
        </div>
      </div>

      {/* TABS DE GESTIÓN */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full h-auto p-1.5 bg-muted/60 rounded-xl gap-1.5">
          <TabsTrigger
            value="redeem-desk"
            className="py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
          >
            <CheckCircle2Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">Validar Canje</span>
            {pendingRedemptions.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold"
              >
                {pendingRedemptions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="rewards"
            className="py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
          >
            <GiftIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Catálogo de Premios</span>
            {(rewards?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.2 text-[10px]">
                {rewards?.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
          >
            <ClockIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Historial de Canjes</span>
            {totalRedemptionsCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0.2 text-[10px]">
                {totalRedemptionsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="py-2.5 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Configuración</span>
            <Badge
              variant="outline"
              className={`ml-1 px-1.5 py-0.2 text-[10px] ${
                currentConfig.isActive
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-slate-400 text-slate-500"
              }`}
            >
              {currentConfig.isActive ? "Activo" : "Pausado"}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: VALIDAR CANJE (RECEPCIÓN / CAJA) */}
        {/* ================================================================= */}
        <TabsContent value="redeem-desk" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* PANEL PRINCIPAL DE BÚSQUEDA Y VALIDACIÓN */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-primary/20 shadow-sm">
                <CardHeader className="bg-muted/20">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <SearchIcon className="w-5 h-5 text-primary" />
                    Mesa de Validación y Entrega de Premios
                  </CardTitle>
                  <CardDescription>
                    Pide al usuario el código alfanumérico generado en su app (ej: TC-A7K29B) para verificar y entregar el premio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <div className="relative flex-1">
                      <Input
                        placeholder="Escribe el código (ej: TC-ABC123)"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleSearchCode()}
                        className="font-mono text-base uppercase tracking-wider pl-3 pr-10 w-full"
                      />
                      {searchCode && (
                        <button
                          type="button"
                          onClick={() => setSearchCode("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <Button
                      onClick={handleSearchCode}
                      disabled={isSearching || !searchCode.trim()}
                      className="sm:w-36 font-medium"
                    >
                      {isSearching ? (
                        <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <SearchIcon className="w-4 h-4 mr-2" />
                      )}
                      Validar Código
                    </Button>
                  </div>

                  {/* TARJETA DE RESULTADO DE VALIDACIÓN */}
                  {foundRedemption ? (
                    <div className="mt-6 border rounded-xl p-5 bg-card shadow-sm space-y-5 animate-in fade-in-50 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Código de Canje
                          </span>
                          <h3 className="text-2xl font-mono font-bold text-primary tracking-widest mt-0.5">
                            {foundRedemption.code}
                          </h3>
                        </div>
                        <div>{getStatusBadge(foundRedemption.status)}</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border">
                          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <GiftIcon className="w-3.5 h-3.5 text-primary" /> Premio Solicitado
                          </span>
                          <p className="text-base font-semibold">
                            {foundRedemption.rewardNameSnapshot}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Costo: <span className="font-bold text-foreground">{foundRedemption.rewardCostSnapshot} pts</span>
                          </p>
                        </div>

                        <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border">
                          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-primary" /> Datos del Jugador
                          </span>
                          <p className="text-base font-semibold">
                            {foundRedemption.user?.name || "Usuario registrado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {foundRedemption.user?.email || "Sin email"}
                            {foundRedemption.user?.phone && ` • Cel: ${foundRedemption.user.phone}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <span>
                          Solicitado el:{" "}
                          <strong className="text-foreground">
                            {format(new Date(foundRedemption.requestedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                          </strong>
                        </span>
                        <span>
                          Válido hasta:{" "}
                          <strong className="text-foreground">
                            {format(new Date(foundRedemption.expiresAt), "dd/MM/yyyy", { locale: es })}
                          </strong>
                        </span>
                      </div>

                      {/* ACCIONES DISPONIBLES SEGÚN ESTADO */}
                      {foundRedemption.status === "PENDING" && (
                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-end border-t">
                          <Button
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 border-destructive/30"
                            onClick={() => handleOpenReject(foundRedemption.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircleIcon className="w-4 h-4 mr-2" />
                            Rechazar y Reembolsar
                          </Button>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => deliverMutation.mutate(foundRedemption.code)}
                            disabled={deliverMutation.isPending}
                          >
                            {deliverMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2Icon className="w-4 h-4 mr-2" />
                            )}
                            Confirmar Entrega del Premio
                          </Button>
                        </div>
                      )}

                      {foundRedemption.status === "DELIVERED" && (
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                          <CheckCircle2Icon className="w-4 h-4 shrink-0" />
                          <span>
                            Este premio ya fue entregado y validado
                            {foundRedemption.resolvedAt &&
                              ` el ${format(new Date(foundRedemption.resolvedAt), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}`}.
                          </span>
                        </div>
                      )}

                      {foundRedemption.status === "REJECTED" && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                          <XCircleIcon className="w-4 h-4 shrink-0" />
                          <span>
                            Canje rechazado. Motivo: &quot;{foundRedemption.rejectReason || "No especificado"}&quot;. Los puntos fueron reembolsados.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 p-4 rounded-xl border border-dashed bg-muted/10 text-muted-foreground flex items-center gap-3">
                      <CheckCircle2Icon className="w-5 h-5 text-primary/70 shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-foreground">Instrucciones para Recepción / Caja</p>
                        <p className="mt-0.5">Ingresa el código que el cliente te muestre en su teléfono o haz clic en &quot;Cargar&quot; en la lista de canjes pendientes de la derecha.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* PANEL LATERAL: CANJES PENDIENTES DE RETIRO */}
            <div className="lg:col-span-5">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-amber-500" />
                      Canjes Pendientes de Retiro
                    </CardTitle>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold">
                      {pendingRedemptions.length} en espera
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Premios solicitados por jugadores listos para ser entregados en el club.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {pendingRedemptions.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground border rounded-xl border-dashed flex flex-col items-center justify-center">
                      <CheckCircle2Icon className="w-8 h-8 text-emerald-500/50 mb-2" />
                      <p className="font-medium text-foreground">No hay canjes pendientes</p>
                      <p className="mt-0.5">Todos los premios canjeados ya fueron entregados.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {pendingRedemptions.map((red) => (
                        <div
                          key={red.id}
                          className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs shadow-sm"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary text-sm">
                                {red.code}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                {red.rewardCostSnapshot} pts
                              </Badge>
                            </div>
                            <p className="font-medium text-foreground truncate">
                              {red.rewardNameSnapshot}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {red.user?.name || "Jugador"} • {format(new Date(red.requestedAt), "dd/MM HH:mm", { locale: es })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs shrink-0 font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => {
                              setSearchCode(red.code);
                              setFoundRedemption(red);
                            }}
                          >
                            Cargar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: CATÁLOGO DE PREMIOS */}
        {/* ================================================================= */}
        <TabsContent value="rewards" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Catálogo de Premios</h2>
              <p className="text-sm text-muted-foreground">
                Configura los productos, bebidas o beneficios que los jugadores pueden canjear con sus puntos.
              </p>
            </div>
            <Button onClick={openCreateReward} className="gap-2">
              <PlusIcon className="w-4 h-4" /> Nuevo Premio
            </Button>
          </div>

          {/* KPI CARDS RESUMEN CATÁLOGO */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-card shadow-sm border">
              <span className="text-xs text-muted-foreground font-medium">Premios Activos</span>
              <p className="text-2xl font-bold mt-1 text-primary">
                {rewards?.filter((r) => r.isActive).length ?? 0}
              </p>
            </Card>
            <Card className="p-4 bg-card shadow-sm border">
              <span className="text-xs text-muted-foreground font-medium">Puntaje Mínimo de Canje</span>
              <p className="text-2xl font-bold mt-1">
                {rewards && rewards.length > 0
                  ? Math.min(...rewards.map((r) => r.pointsCost))
                  : 0}{" "}
                <span className="text-xs font-normal text-muted-foreground">pts</span>
              </p>
            </Card>
            <Card className="p-4 bg-card shadow-sm border col-span-2 md:col-span-1">
              <span className="text-xs text-muted-foreground font-medium">Total de Variedad de Premios</span>
              <p className="text-2xl font-bold mt-1">
                {rewards?.length ?? 0}
              </p>
            </Card>
          </div>

          {isLoadingRewards ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : !rewards || rewards.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <GiftIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                <p className="font-semibold text-lg">Aún no tienes premios en tu catálogo</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Agrega bebidas hidratantes, pelotas de pádel, toallas del club o descuentos en alquiler para incentivar a tus jugadores.
                </p>
                <Button onClick={openCreateReward} variant="outline" className="mt-2">
                  <PlusIcon className="w-4 h-4 mr-2" /> Crear Primer Premio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => (
                <Card
                  key={reward.id}
                  className={`transition-all hover:shadow-md ${
                    !reward.isActive ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold line-clamp-1">
                        {reward.name}
                      </CardTitle>
                      <Badge
                        variant={reward.isActive ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {reward.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    {reward.description && (
                      <CardDescription className="line-clamp-2 text-xs">
                        {reward.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">
                        Costo de canje:
                      </span>
                      <span className="text-lg font-bold text-primary flex items-center gap-1">
                        <SparklesIcon className="w-4 h-4" />
                        {reward.pointsCost} pts
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-1 flex items-center justify-end gap-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditReward(reward)}
                    >
                      <Edit2Icon className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`¿Desactivar el premio "${reward.name}"?`)) {
                          deleteRewardMutation.mutate(reward.id);
                        }
                      }}
                    >
                      <Trash2Icon className="w-3.5 h-3.5 mr-1" /> Desactivar
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 3: HISTORIAL DE CANJES */}
        {/* ================================================================= */}
        <TabsContent value="history" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Historial de Canjes</h2>
              <p className="text-sm text-muted-foreground">
                Revisa los premios solicitados, entregados y expirados.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los Estados</SelectItem>
                  <SelectItem value="PENDING">Pendientes</SelectItem>
                  <SelectItem value="DELIVERED">Entregados</SelectItem>
                  <SelectItem value="REJECTED">Rechazados</SelectItem>
                  <SelectItem value="EXPIRED">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI CARDS RESUMEN HISTORIAL */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-card shadow-sm border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total Solicitudes</span>
                <GiftIcon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold mt-1">{totalRedemptionsCount}</p>
            </Card>
            <Card className="p-4 bg-card shadow-sm border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Entregados</span>
                <CheckCircle2Icon className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {deliveredRedemptions.length}
              </p>
            </Card>
            <Card className="p-4 bg-card shadow-sm border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Pendientes</span>
                <ClockIcon className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {pendingRedemptions.length}
              </p>
            </Card>
            <Card className="p-4 bg-card shadow-sm border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Puntos Entregados</span>
                <AwardIcon className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold mt-1">
                {totalPointsRedeemed}{" "}
                <span className="text-xs font-normal text-muted-foreground">pts</span>
              </p>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoadingRedemptions ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !redemptions || redemptions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No se encontraron canjes registrados con este filtro.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Premio</TableHead>
                        <TableHead>Puntos</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Fecha Solicitud</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redemptions.map((red) => (
                        <TableRow key={red.id}>
                          <TableCell className="font-mono font-bold text-primary">
                            {red.code}
                          </TableCell>
                          <TableCell className="font-medium">
                            {red.rewardNameSnapshot}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold">{red.rewardCostSnapshot}</span> pts
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {red.user?.name || "Jugador"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {red.user?.email}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(red.requestedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>{getStatusBadge(red.status)}</TableCell>
                          <TableCell className="text-right">
                            {red.status === "PENDING" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSearchCode(red.code);
                                  setFoundRedemption(red);
                                  setActiveTab("redeem-desk");
                                }}
                              >
                                Procesar
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {red.resolvedAt ? format(new Date(red.resolvedAt), "dd/MM/yyyy", { locale: es }) : "—"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 4: CONFIGURACIÓN DEL PROGRAMA */}
        {/* ================================================================= */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reglas de Acumulación de Puntos</CardTitle>
              <CardDescription>
                Define la forma en que los jugadores acumularán puntos al reservar en tu club.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingConfig ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <>
                  {/* SWITCH MAESTRO */}
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">
                        Activar Programa de Fidelidad
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Permite que las reservas pagadas al 100% otorguen puntos automáticamente.
                      </p>
                    </div>
                    <Switch
                      checked={currentConfig.isActive}
                      onCheckedChange={(checked) =>
                        setConfigForm({ ...currentConfig, isActive: checked })
                      }
                    />
                  </div>

                  {/* SELECTOR DE MODO */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Modalidad de Acumulación
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* OPCIÓN MODO A */}
                      <div
                        onClick={() =>
                          setConfigForm({ ...currentConfig, mode: "A" })
                        }
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          currentConfig.mode === "A"
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm flex items-center gap-2">
                            <SunIcon className="w-4 h-4 text-amber-500" /> Modo A: Por Horario
                          </span>
                          <input
                            type="radio"
                            name="loyalty_mode"
                            checked={currentConfig.mode === "A"}
                            onChange={() =>
                              setConfigForm({ ...currentConfig, mode: "A" })
                            }
                            className="text-primary focus:ring-primary"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Otorga diferente cantidad de puntos según si la reserva se juega en horario diurno o nocturno.
                        </p>
                      </div>

                      {/* OPCIÓN MODO B */}
                      <div
                        onClick={() =>
                          setConfigForm({ ...currentConfig, mode: "B" })
                        }
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          currentConfig.mode === "B"
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-muted hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-primary" /> Modo B: Por Cantidad de Reservas
                          </span>
                          <input
                            type="radio"
                            name="loyalty_mode"
                            checked={currentConfig.mode === "B"}
                            onChange={() =>
                              setConfigForm({ ...currentConfig, mode: "B" })
                            }
                            className="text-primary focus:ring-primary"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Premia la constancia: el usuario acumula reservas pagadas y recibe un bono cada X reservas.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PARÁMETROS SEGÚN EL MODO SELECCIONADO */}
                  {currentConfig.mode === "A" ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <SunIcon className="w-4 h-4 text-amber-500" /> Puntos en Horario Diurno
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={currentConfig.dayPoints}
                          onChange={(e) =>
                            setConfigForm({
                              ...currentConfig,
                              dayPoints: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Puntos por cada reserva antes del horario nocturno.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <MoonIcon className="w-4 h-4 text-indigo-500" /> Puntos en Horario Nocturno
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={currentConfig.nightPoints}
                          onChange={(e) =>
                            setConfigForm({
                              ...currentConfig,
                              nightPoints: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Puntos por cada reserva nocturna (suele premiarse con más puntos).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <ClockIcon className="w-4 h-4 text-muted-foreground" /> Inicio Horario Nocturno
                        </Label>
                        <Input
                          type="time"
                          value={currentConfig.nightStartsAt || "18:00"}
                          onChange={(e) =>
                            setConfigForm({
                              ...currentConfig,
                              nightStartsAt: e.target.value,
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Hora a partir de la cual aplica el puntaje nocturno (HH:mm).
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">
                          Otorgar bono cada cuántas reservas
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentConfig.bonusEveryX}
                          onChange={(e) =>
                            setConfigForm({
                              ...currentConfig,
                              bonusEveryX: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Ejemplo: 5 para otorgar el bono en la 5ta, 10ma, 15va reserva...
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">
                          Puntos otorgados como Bono
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentConfig.bonusPoints}
                          onChange={(e) =>
                            setConfigForm({
                              ...currentConfig,
                              bonusPoints: Number(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Cantidad total de puntos que recibe el jugador al alcanzar el múltiplo.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-end">
              <Button
                onClick={handleSaveConfig}
                disabled={updateConfigMutation.isPending || isLoadingConfig}
                className="gap-2"
              >
                {updateConfigMutation.isPending && (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                )}
                Guardar Configuración
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================================= */}
      {/* MODAL CREAR / EDITAR PREMIO */}
      {/* ================================================================= */}
      <Dialog open={isRewardModalOpen} onOpenChange={setIsRewardModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? "Editar Premio" : "Nuevo Premio"}
            </DialogTitle>
            <DialogDescription>
              Configura los datos del producto o beneficio canjeable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reward-name">Nombre del Premio *</Label>
              <Input
                id="reward-name"
                placeholder="Ej: Bebida Hidratante 500ml"
                value={rewardForm.name}
                onChange={(e) =>
                  setRewardForm({ ...rewardForm, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reward-cost">Costo en Puntos *</Label>
              <Input
                id="reward-cost"
                type="number"
                min="1"
                placeholder="50"
                value={rewardForm.pointsCost}
                onChange={(e) =>
                  setRewardForm({
                    ...rewardForm,
                    pointsCost: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reward-desc">Descripción (Opcional)</Label>
              <Textarea
                id="reward-desc"
                placeholder="Detalles sobre marcas, condiciones o entrega..."
                rows={3}
                value={rewardForm.description}
                onChange={(e) =>
                  setRewardForm({ ...rewardForm, description: e.target.value })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="reward-active" className="text-sm">
                  Premio Activo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Visible y disponible para los jugadores
                </p>
              </div>
              <Switch
                id="reward-active"
                checked={rewardForm.isActive}
                onCheckedChange={(checked) =>
                  setRewardForm({ ...rewardForm, isActive: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRewardModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => saveRewardMutation.mutate()}
              disabled={saveRewardMutation.isPending || !rewardForm.name.trim()}
            >
              {saveRewardMutation.isPending && (
                <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
              )}
              {editingReward ? "Guardar Cambios" : "Crear Premio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* MODAL RECHAZAR CANJE */}
      {/* ================================================================= */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircleIcon className="w-5 h-5" /> Rechazar Canje
            </DialogTitle>
            <DialogDescription>
              Al rechazar el canje, los puntos serán reembolsados automáticamente al saldo del usuario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="reject-reason">Motivo del Rechazo *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ej: Producto sin stock temporal en el almacén..."
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectingRedemptionId) {
                  rejectMutation.mutate({
                    id: rejectingRedemptionId,
                    reason: rejectReason.trim(),
                  });
                }
              }}
            >
              {rejectMutation.isPending && (
                <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
              )}
              Confirmar Rechazo y Reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
