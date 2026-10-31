"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, KeyRoundIcon, MailIcon, ShieldCheckIcon, UserIcon, Loader2Icon } from "lucide-react";
import {
  ClubStaffUser,
  CreateClubStaffUserDto,
  StaffPermission,
  STAFF_PERMISSIONS_LIST,
  createClubStaffUser,
  updateClubStaffUser,
} from "@/lib/club-users";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: ClubStaffUser | null;
}

export function UserModal({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
}: UserModalProps) {
  const isEditing = Boolean(userToEdit);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<StaffPermission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos al abrir o cambiar de modo
  useEffect(() => {
    if (userToEdit) {
      setName(userToEdit.name || "");
      setEmail(userToEdit.email || "");
      setPassword(""); // Dejar en blanco en edición por seguridad
      setSelectedPermissions(userToEdit.permissions || []);
    } else {
      setName("");
      setEmail("");
      setPassword("");
      // Por defecto, sugerir permisos operativos básicos
      setSelectedPermissions(["dashboard", "bookings", "payments"]);
    }
  }, [userToEdit, isOpen]);

  const handleTogglePermission = (permissionId: StaffPermission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId],
    );
  };

  const handleSelectAllPermissions = () => {
    setSelectedPermissions(STAFF_PERMISSIONS_LIST.map((p) => p.id));
  };

  const handleDeselectAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validaciones
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      toast.error("Por favor ingresa un correo electrónico válido");
      return;
    }

    if (!isEditing && (!password || password.length < 6)) {
      toast.error("La contraseña inicial debe tener al menos 6 caracteres");
      return;
    }

    if (isEditing && password && password.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (selectedPermissions.length === 0) {
      toast.error("Debes asignar al menos un componente del menú al recepcionista");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && userToEdit) {
        await updateClubStaffUser(userToEdit.id, {
          name: trimmedName,
          email: trimmedEmail,
          ...(password ? { password } : {}),
          permissions: selectedPermissions,
        });
        toast.success(`Usuario ${trimmedName} actualizado correctamente`);
      } else {
        const dto: CreateClubStaffUserDto = {
          name: trimmedName,
          email: trimmedEmail,
          password,
          role: "RECEPCIONISTA",
          permissions: selectedPermissions,
        };
        await createClubStaffUser(dto);
        toast.success(`Recepcionista ${trimmedName} creado exitosamente`);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Error al procesar la solicitud del usuario";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            {isEditing ? "Editar Usuario Recepcionista" : "Crear Nuevo Usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica los datos personales y ajusta los accesos del recepcionista a los módulos del club."
              : "Registra a un nuevo recepcionista asociado exclusivamente a este club y define qué apartados podrá operar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* DATOS PRINCIPALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="staff-name" className="text-sm font-semibold flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                Nombre Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-name"
                placeholder="Ej. Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Correo */}
            <div className="space-y-2">
              <Label htmlFor="staff-email" className="text-sm font-semibold flex items-center gap-1.5">
                <MailIcon className="w-4 h-4 text-muted-foreground" />
                Gmail / Correo Electrónico <span className="text-destructive">*</span>
              </Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="ejemplo@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            {/* Rol */}
            <div className="space-y-2">
              <Label htmlFor="staff-role" className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheckIcon className="w-4 h-4 text-muted-foreground" />
                Rol Asignado
              </Label>
              <Input
                id="staff-role"
                value="Recepcionista"
                disabled
                className="bg-muted cursor-not-allowed font-medium text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Rol secundario con permisos configurables por el administrador.
              </p>
            </div>

            {/* Contraseña */}
            <div className="space-y-2">
              <Label htmlFor="staff-password" className="text-sm font-semibold flex items-center gap-1.5">
                <KeyRoundIcon className="w-4 h-4 text-muted-foreground" />
                {isEditing ? "Nueva Contraseña (Opcional)" : "Contraseña de Acceso"}
                {!isEditing && <span className="text-destructive">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    isEditing
                      ? "Dejar en blanco para mantener actual"
                      : "Mínimo 6 caracteres"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOffIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
              {isEditing && (
                <p className="text-[11px] text-muted-foreground">
                  Solo llena este campo si deseas cambiar la contraseña del usuario.
                </p>
              )}
            </div>
          </div>

          {/* ASIGNACIÓN DE COMPONENTES DEL MENÚ */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold text-foreground">
                  Asignación de Componentes del Menú
                </Label>
                <p className="text-xs text-muted-foreground">
                  Selecciona a qué secciones del panel tendrá acceso este recepcionista.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllPermissions}
                  disabled={isSubmitting}
                  className="text-xs h-7 px-2"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllPermissions}
                  disabled={isSubmitting}
                  className="text-xs h-7 px-2 text-muted-foreground"
                >
                  Ninguno
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {STAFF_PERMISSIONS_LIST.map((perm) => {
                const isChecked = selectedPermissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleTogglePermission(perm.id)}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col select-none">
                      <span className="text-sm font-semibold leading-tight text-foreground">
                        {perm.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {perm.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isSubmitting && <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Guardar Cambios" : "Crear Recepcionista"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
