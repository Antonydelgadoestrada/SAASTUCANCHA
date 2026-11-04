"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  UsersIcon,
  PlusIcon,
  SearchIcon,
  EditIcon,
  Trash2Icon,
  UserCheckIcon,
  UserXIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  LockIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserModal } from "@/components/club/user-modal";
import {
  ClubStaffUser,
  getClubStaffUsers,
  toggleClubStaffUserStatus,
  deleteClubStaffUser,
  STAFF_PERMISSIONS_LIST,
} from "@/lib/club-users";

export function ClubUsersContent() {
  const [users, setUsers] = useState<ClubStaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Estados de modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ClubStaffUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ClubStaffUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar usuarios
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getClubStaffUsers();
      setUsers(data || []);
    } catch (err: any) {
      console.error("Error al cargar usuarios del club:", err);
      toast.error("Error al cargar los usuarios del club", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtrado
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.isActive) ||
        (statusFilter === "INACTIVE" && !u.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [users]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: ClubStaffUser) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (user: ClubStaffUser) => {
    const newStatus = !user.isActive;
    try {
      await toggleClubStaffUserStatus(user.id, newStatus);
      toast.success(
        newStatus
          ? `Acceso activado para ${user.name}`
          : `Acceso desactivado para ${user.name}`,
      );
      loadUsers();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Error al cambiar el estado del usuario",
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteClubStaffUser(userToDelete.id);
      toast.success(`Usuario ${userToDelete.name} eliminado del club`);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Error al eliminar el usuario",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const formatPermissionsLabel = (permissions: string[] = []) => {
    if (permissions.length === 0) return "Sin permisos";
    if (permissions.length === STAFF_PERMISSIONS_LIST.length) return "Acceso total";
    return `${permissions.length} módulos asignados`;
  };

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-primary" />
            Usuarios del Club
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra recepcionistas y personal secundario con acceso a tu club deportivo.
          </p>
        </div>

        {/* BOTÓN + CREAR USUARIO EN VERDE OFICIAL */}
        <Button
          onClick={handleOpenCreateModal}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm gap-2 shrink-0"
        >
          <PlusIcon className="w-5 h-5" />
          + CREAR USUARIO
        </Button>
      </div>

      {/* TARJETAS RESUMEN (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Personal
            </CardTitle>
            <UsersIcon className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Recepcionistas registrados</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Accesos Activos
            </CardTitle>
            <UserCheckIcon className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Con acceso habilitado al sistema</p>
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acceso Desactivado
            </CardTitle>
            <UserXIcon className="w-4 h-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.inactive}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bloqueados por el administrador</p>
          </CardContent>
        </Card>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <Card className="border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo electrónico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "ALL"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Todos ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ACTIVE")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "ACTIVE"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Activos ({stats.active})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("INACTIVE")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === "INACTIVE"
                      ? "bg-background text-rose-600 dark:text-rose-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Desactivados ({stats.inactive})
                </button>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={loadUsers}
                disabled={isLoading}
                title="Actualizar listado"
              >
                <RefreshCwIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLA PRINCIPAL DE USUARIOS */}
      <Card className="border">
        <CardContent className="p-0">
          <div className="rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Nombre
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Gmail / Correo
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Rol
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Permisos Asignados
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Estado
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <RefreshCwIcon className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Cargando usuarios del club...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-medium text-foreground">No se encontraron usuarios</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {searchQuery
                          ? "Intenta con otro término de búsqueda."
                          : "Haz clic en '+ CREAR USUARIO' para registrar a tu primer recepcionista."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const initials = user.name
                      ? user.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      : "RC";

                    return (
                      <TableRow key={user.id} className="hover:bg-muted/30">
                        {/* 1. NOMBRE */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm text-foreground">
                                {user.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ID: {user.id.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 2. GMAIL / CORREO */}
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-foreground">
                            <MailIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>{user.email}</span>
                          </div>
                        </TableCell>

                        {/* 3. ROL */}
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-medium text-xs bg-muted text-foreground border"
                          >
                            <ShieldCheckIcon className="w-3 h-3 mr-1 text-primary" />
                            Recepcionista
                          </Badge>
                        </TableCell>

                        {/* Permisos */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground font-medium">
                            {formatPermissionsLabel(user.permissions)}
                          </span>
                        </TableCell>

                        {/* 4. ESTADO */}
                        <TableCell>
                          {user.isActive ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold text-xs"
                            >
                              ACTIVO
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold text-xs"
                            >
                              ACCESO DESACTIVADO
                            </Badge>
                          )}
                        </TableCell>

                        {/* 5. ACCIONES */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Acción rápida Editar */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(user)}
                              className="h-8 px-2 text-muted-foreground hover:text-foreground"
                              title="Editar usuario y permisos"
                            >
                              <EditIcon className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline text-xs">Editar</span>
                            </Button>

                            {/* Dropdown de más acciones */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVerticalIcon className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="text-xs font-semibold">
                                  Acciones del Usuario
                                </DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenEditModal(user)}>
                                  <EditIcon className="w-4 h-4 mr-2" />
                                  Editar datos y permisos
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                                  {user.isActive ? (
                                    <>
                                      <UserXIcon className="w-4 h-4 mr-2 text-rose-500" />
                                      <span className="text-rose-600 dark:text-rose-400">
                                        Desactivar acceso
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheckIcon className="w-4 h-4 mr-2 text-emerald-500" />
                                      <span className="text-emerald-600 dark:text-emerald-400">
                                        Activar acceso
                                      </span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setUserToDelete(user)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2Icon className="w-4 h-4 mr-2" />
                                  Eliminar usuario
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL DE CREAR / EDITAR */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadUsers}
        userToEdit={editingUser}
      />

      {/* DIÁLOGO DE CONFIRMACIÓN EXPLÍCITA DE ELIMINACIÓN */}
      <AlertDialog
        open={Boolean(userToDelete)}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-destructive mb-1">
              <div className="p-2.5 rounded-full bg-destructive/10">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <AlertDialogTitle className="text-lg font-bold">
                ¿Estás seguro de eliminar a este usuario?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground pt-1">
              Esta acción afectará su acceso al club. El usuario{" "}
              <strong className="text-foreground">{userToDelete?.name}</strong> (
              {userToDelete?.email}) no podrá volver a iniciar sesión ni operar en el sistema.
              Las reservas y registros históricos asociados se mantendrán para auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              {isDeleting ? "Eliminando..." : "Eliminar Usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
