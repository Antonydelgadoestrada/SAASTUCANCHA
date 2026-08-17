import { ClubFormValues } from "@/components/auth/register-form"
import type { User, UserRole } from "@/lib/types"
import api from "./axios"
// utils/auth.ts
import { jwtDecode } from "jwt-decode";

export interface JwtPayload {
  email: string;
  role: UserRole;
  id: string;
  name: string;
}

export function decodeToken(token: string): JwtPayload {
  return jwtDecode(token);
}

const club1 = {
  "id": "d310e693-4f95-4d95-836d-6807dbb29ee2",
  "name": "Club Deportivo Elite",
  "email": "contacto@clubelite.com",
  "phone": "987654321",
  "address": "Av. Principal 456",
  "district": "Lima",
  "description": "Club completo con canchas de fútbol, vóley y piscina.",
  "logo": "https://example.com/logo.png",
  "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
  ],
  "socialMedia": {
      "facebook": "https://facebook.com/clubelite",
      "instagram": "https://instagram.com/clubelite"
  },
  "coordinates": {
      "lat": -12.0464,
      "lng": -77.0428
  },
  "services": [
      "cochera",
      "wifi",
      "piscina"
  ],
  "status": "APPROVED",
  "approvedAt": "2025-06-24T00:48:37.727Z",
  "createdAt": "2025-06-24T05:48:37.930Z",
  "updatedAt": "2025-06-24T05:48:37.930Z"
}

const club2 = {
  "id": "62be1c1d-e91c-43c1-8b88-8b02cc1cf5e3",
  "name": "Edgar",
  "email": "democlub1@demo.com",
  "phone": "933282785",
  "address": "nothin",
  "district": "lamolina",
  "description": "dskajfkasdjflasdfjasd",
  "logo": null,
  "images": [],
  "socialMedia": null,
  "coordinates": {
      "lat": -11.991564,
      "lng": -77.0707092
  },
  "services": [
      "parking",
      "cafeteria"
  ],
  "status": "PENDING",
  "approvedAt": null,
  "createdAt": "2025-07-03T10:52:53.011Z",
  "updatedAt": "2025-07-03T10:52:53.011Z"
}

// Exportar la lista de usuarios para que sea accesible desde otros componentes
// Agregar al principio del archivo, después de la importación
export const users = [
  {
    id: "1",
    name: "Usuario Demo",
    email: "user1@demo.com",
    password: "abcdef",
    role: "USER",
    verified: true,
    createdAt: new Date(2025, 5, 1),
  },
  {
    id: "2",
    name: "Club Aprobado",
    email: "club1@demo.com",
    password: "qwerty",
    role: "CLUB",
    club: club1,
    verified: true,
    approved: true,
    "createdAt": "2025-06-24T05:48:37.391Z",
    "updatedAt": "2025-06-24T05:48:37.391Z",
    phone: "123-456-7893",
    // address: "Av. Ejemplo 123, Zona Norte",
    // city: "Ciudad Ejemplo",
    state: "Estado Ejemplo",
    description: "Club deportivo con 4 canchas de fútbol y 2 de tenis.",
    // coordinates: { lat: -12.0464, lng: -77.0428 },
  },
  {
    id: "3",
    name: "Club Pendiente",
    email: "club2@demo.com",
    password: "123456",
    role: "CLUB",
    verified: true,
    approved: false,
    // createdAt: new Date(2025, 5, 12),
    "createdAt": "2025-07-03T10:52:50.630Z",
    "updatedAt": "2025-07-03T10:52:50.630Z",
    phone: "123-456-7890",
    // address: "Av. Del Este 789, Zona Este",
    // city: "Ciudad Ejemplo",
    // state: "Estado Ejemplo",
    description: "Club deportivo con 5 canchas de tenis y 3 de pádel.",
    // coordinates: { lat: -12.1196, lng: -77.0365 },
    club: club2,

  },
  {
    id: "4",
    name: "Administrador",
    email: "admin@demo.com",
    password: "admin123",
    role: "ADMIN",
    verified: true,
    createdAt: new Date(2025, 5, 1),
  },
]

// Simular inicio de sesión
export async function loginUser(email: string, password: string): Promise<User> {
  const {data} = await api.post("/auth/login",  {
    email, password
  })
  const user = (decodeToken(data.access_token))
  if (typeof window !== "undefined") {
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...user
      }),
    )
    localStorage.setItem(
      "token",
      data.access_token
    )
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role:   user.role 
  }
}

export async function resetPassword(email: string){
  // Simular retraso de red
  const {data} = await api.post("/auth/forgot-password",  {
    email
  })

  return data.message
}

// Modificar la función registerUser para que retorne el usuario creado
export async function registerUser(userData: {
  name: string
  email: string
  password: string
  role: string,
  club?: ClubFormValues
  // services?: string[]
  // coordinates?: { lat: number; lng: number }
  // [key: string]: any
}): Promise<User> {
  // Simular retraso de red
   // await new Promise((resolve) => setTimeout(resolve, 1000))
   const result = await api.post('auth/register', userData)
   // Verificar si el correo ya está registrado
  

  // Guardar sesión en localStorage para usuarios normales (solo para demo)
  if (userData.role === "USER" && typeof window !== "undefined") {
    // localStorage.setItem(
    //   "user",
    //   JSON.stringify({
    //     id: newUser.id,
    //     name: newUser.name,
    //     email: newUser.email,
    //     role: newUser.role,
    //   }),
    // )
  }

  return {
    id: 'result.id',
    name: 'result.name',
    email: 'result.email',
    role:   "USER" 
  }
}

// Simular cierre de sesión
export async function logout(): Promise<void> {
  // Simular retraso de red
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Eliminar sesión de localStorage
  if (typeof window !== "undefined") {
    localStorage.removeItem("user")
  }

  return
}

// Simular verificación de correo electrónico
export async function verifyEmail(token: string): Promise<void> {
  // Simular retraso de red
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // En una aplicación real, aquí se verificaría el token y se actualizaría el estado del usuario
  console.log(`Verificando correo con token: ${token}`)

  return
}

// Simular aprobación de club
// export async function approveClub(clubId: string): Promise<void> {
//   // Simular retraso de red
//   await new Promise((resolve) => setTimeout(resolve, 1000))

//   // En una aplicación real, aquí se actualizaría el estado del club en la base de datos
//   const clubIndex = users.findIndex((u) => u.id === clubId && u.role === "CLUB")

//   if (clubIndex !== -1) {
//     users[clubIndex].approved = true
//   } else {
//     throw new Error("Club no encontrado")
//   }

//   return
// }

// Simular rechazo de club
// export async function rejectClub(clubId: string): Promise<void> {
//   // Simular retraso de red
//   await new Promise((resolve) => setTimeout(resolve, 1000))

//   // En una aplicación real, aquí se actualizaría el estado del club en la base de datos
//   const clubIndex = users.findIndex((u) => u.id === clubId && u.role === "CLUB")

//   if (clubIndex !== -1) {
//     // Eliminar el club de la lista (o marcar como rechazado en una aplicación real)
//     users.splice(clubIndex, 1)
//   } else {
//     throw new Error("Club no encontrado")
//   }

//   return
// }
