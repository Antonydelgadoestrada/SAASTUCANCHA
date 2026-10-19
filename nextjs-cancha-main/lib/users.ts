import api from "./axios"
import type { StaffUser } from "./types"

// Funciones existentes de administración general
export const getAllUser = async () => {
  const result = await api.get("/users/club")
  return result.data
}

export const editUser = async (data: any) => {
  if (data.venueId) {
    delete data.venueId
  }
  const result = await api.put(`/users/${data.id}`, data)
  return result.data
}

export const getAdminDashboardStats = async () => {
  const result = await api.get("/users/admin/dashboard-stats")
  return result.data
}

// Interfaces para gestión de personal de club
export interface CreateStaffPayload {
  name: string
  email: string
  role: string
  password: string
}

export interface UpdateStaffPayload {
  name?: string
  email?: string
  role?: string
  password?: string
}

/**
 * Obtiene la lista de usuarios del personal del club autenticado
 */
export async function getClubStaff(): Promise<StaffUser[]> {
  const res = await api.get("/users/club/staff")
  return res.data
}

/**
 * Crea un nuevo usuario para el club (Recepcionista, Administrador de Club, etc.)
 */
export async function createClubStaff(data: CreateStaffPayload): Promise<StaffUser> {
  const res = await api.post("/users/club/staff", data)
  return res.data
}

/**
 * Actualiza los datos de un usuario de personal del club
 */
export async function updateClubStaff(id: string, data: UpdateStaffPayload): Promise<StaffUser> {
  const res = await api.put(`/users/club/staff/${id}`, data)
  return res.data
}

/**
 * Activa o desactiva el acceso de un usuario de personal del club
 */
export async function toggleClubStaffStatus(id: string): Promise<StaffUser> {
  const res = await api.patch(`/users/club/staff/${id}/toggle-status`)
  return res.data
}

/**
 * Elimina un usuario de personal del club
 */
export async function deleteClubStaff(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/users/club/staff/${id}`)
  return res.data
}
