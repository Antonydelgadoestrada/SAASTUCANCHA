"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import {
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

import type { StaffUser } from "@/lib/types"
import {
  getClubStaff,
  createClubStaff,
  updateClubStaff,
  toggleClubStaffStatus,
  deleteClubStaff,
} from "@/lib/users"

// Esquema de validación para Crear Usuario
const createStaffSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(100, { message: "El nombre es demasiado largo" }),
  email: z
    .string()
    .min(1, { message: "El correo electrónico es obligatorio" })
    .email({ message: "Por favor ingresa un correo electrónico o Gmail válido" }),
  role: z.enum(["RECEPCIONISTA", "ADMIN"], {
    message: "Por favor selecciona un rol válido",
  }),
  password: z
    .string()
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
})

// Esquema de validación para Editar Usuario
const updateStaffSchema = z.object({
  name: z
    .string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  email: z
    .string()
    .min(1, { message: "El correo electrónico es obligatorio" })
    .email({ message: "Por favor ingresa un correo electrónico válido" }),
  role: z.enum(["RECEPCIONISTA", "ADMIN"]),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: "Si deseas cambiar la contraseña, debe tener al menos 6 caracteres",
    }),
})

type CreateStaffFormValues = z.infer<typeof createStaffSchema>
type UpdateStaffFormValues = z.infer<typeof updateStaffSchema>

export function ClubUsersContent() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Usuario seleccionado para editar o eliminar
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null)

  // Control de visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  // Acciones en curso
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)

  // Formulario de creación
  const createForm = useForm<CreateStaffFormValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "RECEPCIONISTA",
      password: "",
    },
  })

  // Formulario de edición
  const editForm = useForm<UpdateStaffFormValues>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "RECEPCIONISTA",
      password: "",
    },
  })

  // Cargar lista de usuarios
  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const data = await getClubStaff()
      setUsers(Array.isArray(data) ? data : [])
    } catch (error: any) {
      toast.error("Error al cargar la lista de usuarios", {
        description: error?.response?.data?.message || "Inténtalo de nuevo más tarde",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Handler para crear usuario
  const onCreateSubmit = async (values: CreateStaffFormValues) => {
    setIsSubmitting(true)
    try {
      await createClubStaff({
        name: values.name.trim(),
        email: values.email.toLowerCase().trim(),
        role: values.role,
        password: values.password,
      })

      toast.success("Usuario creado exitosamente", {
        description: `Se ha enviado un correo de bienvenida a ${values.email} con las credenciales de acceso.`,
      })

      setIsCreateOpen(false)
      createForm.reset({
        name: "",
        email: "",
        role: "RECEPCIONISTA",
        password: "",
      })
      await loadUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo registrar el usuario"
      toast.error("Error al crear usuario", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Abrir modal de edición
  const handleOpenEdit = (user: StaffUser) => {
    setSelectedUser(user)
    editForm.reset({
      name: user.name,
      email: user.email,
      role: (user.role as "RECEPCIONISTA" | "ADMIN") || "RECEPCIONISTA",
      password: "",
    })
    setIsEditOpen(true)
  }

  // Handler para editar usuario
  const onEditSubmit = async (values: UpdateStaffFormValues) => {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await updateClubStaff(selectedUser.id, {
        name: values.name.trim(),
        email: values.email.toLowerCase().trim(),
        role: values.role,
        ...(values.password ? { password: values.password } : {}),
      })

      toast.success("Usuario actualizado correctamente")
      setIsEditOpen(false)
      setSelectedUser(null)
      await loadUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo actualizar el usuario"
      toast.error("Error al actualizar usuario", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handler para activar/desactivar acceso
  const handleToggleStatus = async (user: StaffUser) => {
    setStatusLoadingId(user.id)
    try {
      const updated = await toggleClubStaffStatus(user.id)
      const isNowActive = updated.isActive
      toast.success(
        isNowActive ? "Acceso activado exitosamente" : "Acceso desactivado",
        {
          description: isNowActive
            ? `El usuario ${user.name} ahora puede iniciar sesión.`
            : `Se ha suspendido el inicio de sesión para ${user.name}.`,
        }
      )
      await loadUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo cambiar el estado"
      toast.error("Error al cambiar estado", { description: message })
    } finally {
      setStatusLoadingId(null)
    }
  }

  // Abrir diálogo de confirmación de eliminación
  const handleOpenDelete = (user: StaffUser) => {
    setSelectedUser(user)
    setIsDeleteOpen(true)
  }

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!selectedUser) return
    setIsDeleting(true)
    try {
      await deleteClubStaff(selectedUser.id)
      toast.success("Usuario eliminado", {
        description: `El usuario ${selectedUser.name} ha sido eliminado del club.`,
      })
      setIsDeleteOpen(false)
      setSelectedUser(null)
      await loadUsers()
    } catch (error: any) {
      const message = error?.response?.data?.message || "No se pudo eliminar el usuario"
      toast.error("Error al eliminar", { description: message })
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtro de usuarios
  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.role.toLowerCase().includes(q)
    )
  })

  // Obtener iniciales para avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Cabecera del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Módulo de Usuarios
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Gestiona el personal de recepción y administradores encargados de atender tus canchas y reservas.
          </p>
        </div>

        {/* Botón Crear Usuario (VERDE) */}
        <Button
          onClick={() => {
            createForm.reset({
              name: "",
              email: "",
              role: "RECEPCIONISTA",
              password: "",
            })
            setIsCreateOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors flex items-center gap-2 h-10 px-4 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Crear Usuario</span>
        </Button>
      </div>

      {/* Tarjeta Principal con Buscador y Tabla */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              Lista de Usuarios
              <Badge variant="outline" className="ml-1 text-xs">
                {users.length} {users.length === 1 ? "usuario" : "usuarios"}
              </Badge>
            </CardTitle>

            {/* Buscador */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, gmail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <CardDescription>
            Visualiza el estado de acceso de cada colaborador y sus roles asignados dentro del club.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Cargando usuarios del club...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {searchQuery ? "No se encontraron usuarios" : "Aún no tienes personal registrado"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? "No hay resultados para tu criterio de búsqueda. Intenta con otro término."
                  : "Crea tu primer recepcionista o administrador para que pueda aceptar reservas y atender el club."}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Crear Primer Usuario
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[300px]">NOMBRE</TableHead>
                    <TableHead>GMAIL</TableHead>
                    <TableHead>ROL</TableHead>
                    <TableHead>ESTADO</TableHead>
                    <TableHead className="text-right">ACCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isRecepcionista = user.role === "RECEPCIONISTA"
                    const isStatusUpdating = statusLoadingId === user.id

                    return (
                      <TableRow key={user.id} className="hover:bg-muted/40 transition-colors">
                        {/* NOMBRE */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-foreground leading-none">{user.name}</p>
                              <span className="text-xs text-muted-foreground">
                                Creado el {new Date(user.createdAt).toLocaleDateString("es-PE")}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* GMAIL */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[220px] select-all">{user.email}</span>
                          </div>
                        </TableCell>

                        {/* ROL */}
                        <TableCell>
                          {isRecepcionista ? (
                            <Badge variant="secondary" className="font-medium bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                              <Shield className="w-3 h-3 mr-1" />
                              Recepcionista
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-medium bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                              <Shield className="w-3 h-3 mr-1" />
                              {user.role}
                            </Badge>
                          )}
                        </TableCell>

                        {/* ESTADO */}
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 gap-1.5 py-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-border gap-1.5 py-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                              Desactivado
                            </Badge>
                          )}
                        </TableCell>

                        {/* ACCIONES */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Toggle Estado Rápido */}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isStatusUpdating}
                              onClick={() => handleToggleStatus(user)}
                              className={`h-8 px-2 text-xs gap-1.5 ${
                                user.isActive
                                  ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              }`}
                              title={user.isActive ? "Desactivar acceso" : "Activar acceso"}
                            >
                              {isStatusUpdating ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : user.isActive ? (
                                <>
                                  <UserX className="h-3.5 w-3.5" />
                                  <span className="hidden md:inline">Desactivar</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span className="hidden md:inline">Activar</span>
                                </>
                              )}
                            </Button>

                            {/* Dropdown con Editar y Eliminar */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">Abrir menú</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenEdit(user)} className="cursor-pointer gap-2">
                                  <Pencil className="h-4 w-4 text-blue-600" />
                                  Editar Datos
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleStatus(user)}
                                  className="cursor-pointer gap-2"
                                >
                                  {user.isActive ? (
                                    <>
                                      <UserX className="h-4 w-4 text-amber-600" />
                                      Desactivar Acceso
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 text-emerald-600" />
                                      Activar Acceso
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(user)}
                                  className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar Usuario
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* MODAL CREAR USUARIO (ACCIONADO POR EL BOTÓN VERDE)       */}
      {/* ======================================================== */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              Crear Nuevo Usuario
            </DialogTitle>
            <DialogDescription>
              Registra un nuevo miembro en el equipo de tu club. Se enviará un correo de confirmación a su Gmail con sus credenciales de acceso.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-2">
              {/* 1. NOMBRE */}
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1. Nombre completo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Carlos Alberto Mendoza"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 2. GMAIL */}
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>2. Gmail / Correo electrónico</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ejemplo@gmail.com"
                        type="email"
                        disabled={isSubmitting}
                        autoCapitalize="none"
                        autoCorrect="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Es indispensable que sea un correo válido para recibir notificaciones y reservas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 3. ROL (MODULO) */}
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>3. Rol / Módulo</FormLabel>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RECEPCIONISTA">
                          Recepcionista (Acepta reservas, atiende caja y turnos)
                        </SelectItem>
                        <SelectItem value="ADMIN">
                          Administrador de Club (Gestión completa)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      El rol Recepcionista recibirá los correos de nuevas reservas para auditarlas y confirmarlas.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 4. CONTRASEÑA */}
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>4. Contraseña inicial</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Mínimo 6 caracteres"
                          type={showPassword ? "text" : "password"}
                          disabled={isSubmitting}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Guardar y Enviar Acceso"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL EDITAR USUARIO                                     */}
      {/* ======================================================== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Editar Usuario
            </DialogTitle>
            <DialogDescription>
              Actualiza la información personal, rol o contraseña de este usuario.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-2">
              {/* NOMBRE */}
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* GMAIL */}
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gmail / Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ROL */}
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol asignado</FormLabel>
                    <Select
                      disabled={isSubmitting}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RECEPCIONISTA">Recepcionista</SelectItem>
                        <SelectItem value="ADMIN">Administrador de Club</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CONTRASEÑA NUEVA (OPCIONAL) */}
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva Contraseña (Opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Dejar en blanco para mantener la actual"
                          type={showEditPassword ? "text" : "password"}
                          disabled={isSubmitting}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          tabIndex={-1}
                        >
                          {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Solo escribe una contraseña si deseas cambiar la existente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIÁLOGO DE CONFIRMACIÓN ANTES DE ELIMINAR UN USUARIO      */}
      {/* ======================================================== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <Trash2 className="h-5 w-5" />
              ¿Estás seguro de eliminar este usuario?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Estás a punto de eliminar a <strong>{selectedUser?.name}</strong> ({selectedUser?.email}). Esta acción revocará su acceso al panel de control de manera definitiva y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-white font-medium"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Sí, Eliminar Usuario"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
