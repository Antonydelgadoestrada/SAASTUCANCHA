import api from "./axios";

export type StaffPermission =
  | "dashboard"
  | "payments"
  | "transactions"
  | "schedules"
  | "events"
  | "courts"
  | "bookings"
  | "membership"
  | "loyalty";

export interface ClubStaffUser {
  id: string;
  name: string;
  email: string;
  role: "RECEPCIONISTA";
  isActive: boolean;
  permissions: StaffPermission[];
  createdAt: string;
  updatedAt?: string;
  assignedClubId?: string;
}

export interface CreateClubStaffUserDto {
  name: string;
  email: string;
  password?: string;
  role?: "RECEPCIONISTA";
  permissions: StaffPermission[];
}

export interface UpdateClubStaffUserDto {
  name?: string;
  email?: string;
  password?: string;
  permissions?: StaffPermission[];
  isActive?: boolean;
}

export interface PermissionDefinition {
  id: StaffPermission;
  label: string;
  description: string;
}

export const STAFF_PERMISSIONS_LIST: PermissionDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Métricas generales, resumen diario y ocupación del club.",
  },
  {
    id: "bookings",
    label: "Reservas",
    description: "Gestión, creación, pagos manuales y cancelación de reservas.",
  },
  {
    id: "payments",
    label: "Pagos y Cobros",
    description: "Auditoría de comprobantes y gestión de cobros.",
  },
  {
    id: "transactions",
    label: "Transacciones",
    description: "Control de flujo de caja, ingresos y egresos diarios.",
  },
  {
    id: "courts",
    label: "Canchas",
    description: "Configuración, tarifas y visualización de canchas.",
  },
  {
    id: "schedules",
    label: "Horarios",
    description: "Plantillas de disponibilidad y tarifas por turnos.",
  },
  {
    id: "events",
    label: "Eventos y Bloqueos",
    description: "Creación y gestión de bloqueos de canchas y torneos.",
  },
  {
    id: "loyalty",
    label: "Puntos y Fidelidad",
    description: "Gestión de canjes y entrega de premios por puntos.",
  },
  {
    id: "membership",
    label: "Membresía",
    description: "Consulta del estado de suscripción y plan del club.",
  },
];

/**
 * Obtener todos los usuarios del personal (recepcionistas) del club autenticado
 */
export const getClubStaffUsers = async (): Promise<ClubStaffUser[]> => {
  const response = await api.get("/club/users");
  return response.data;
};

/**
 * Crear un nuevo usuario recepcionista
 */
export const createClubStaffUser = async (
  dto: CreateClubStaffUserDto,
): Promise<ClubStaffUser> => {
  const response = await api.post("/club/users", dto);
  return response.data;
};

/**
 * Actualizar datos, permisos o contraseña de un recepcionista
 */
export const updateClubStaffUser = async (
  id: string,
  dto: UpdateClubStaffUserDto,
): Promise<ClubStaffUser> => {
  const response = await api.put(`/club/users/${id}`, dto);
  return response.data;
};

/**
 * Activar o desactivar inmediatamente el acceso de un recepcionista
 */
export const toggleClubStaffUserStatus = async (
  id: string,
  isActive: boolean,
): Promise<ClubStaffUser> => {
  const response = await api.patch(`/club/users/${id}/status`, { isActive });
  return response.data;
};

/**
 * Eliminar (borrado lógico) un recepcionista del club
 */
export const deleteClubStaffUser = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/club/users/${id}`);
  return response.data;
};
