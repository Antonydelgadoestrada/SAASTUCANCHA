"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { resetPassword } from "@/lib/auth"

const formSchema = z.object({
  email: z.string().email({
    message: "Por favor ingresa un correo electrónico válido.",
  }),
  password: z.string().min(6, {
    message: "La contraseña debe tener al menos 6 caracteres.",
  }),
})

const resetSchema = z.object({
  email: z.string().email({
    message: "Por favor ingresa un correo electrónico válido.",
  }),
})

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showGoogleLoading, setShowGoogleLoading] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
  
    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false, // para manejar la redirección tú mismo
      })
  
      if (res?.error) {
        const decodedError = decodeURIComponent(res.error);
        toast.error(decodedError || "Error al iniciar sesión");
      } else {
        // Opcional: obtén la sesión para saber el rol
        const sessionRes = await fetch("/api/auth/session")
        const session = await sessionRes.json()
  
        toast.success("Inicio de sesión exitoso")
        const callbackUrl = searchParams.get("callbackUrl")
        if (session.user?.role === "ADMIN") {
          router.push("/admin/dashboard")
        } else if (session.user?.role === "CLUB") {
          router.push("/club/dashboard")
        } 
        else if (callbackUrl) {
          router.push(callbackUrl)
        }
        else {
          router.push('/user/bookings')
        }
      }
    } catch (error) {
      toast.error("Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  async function onResetSubmit(values: z.infer<typeof resetSchema>) {
    setIsResetting(true)

    try {
      const result = await resetPassword(values.email)
      toast.success(`Se ha enviado un enlace de recuperación a tu correo electrónico: ${result}`)
      setShowResetDialog(false)
      resetForm.reset()
    } catch (error) {
      toast.error("Error al enviar el correo de recuperación, insertar un correo valido")
    } finally {
      setIsResetting(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setShowGoogleLoading(true)
    try {
      const callbackUrl = searchParams.get("callbackUrl") || '/user/bookings'
      await signIn("google", { callbackUrl})
      toast.success(`Bienvenido`)
    } catch (error) {
      toast.error("Error al iniciar sesión con Google")
    } finally {
      setShowGoogleLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input
                    placeholder="correo@ejemplo.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <Input
                    placeholder="••••••••"
                    type="password"
                    autoCapitalize="none"
                    autoComplete="current-password"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Enlace de recuperación de contraseña */}
          <div className="flex justify-end">
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <DialogTrigger asChild>
                <Button variant="link" className="px-0 text-sm">
                  ¿Olvidaste tu contraseña?
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Recuperar contraseña</DialogTitle>
                  <DialogDescription>
                    Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                  </DialogDescription>
                </DialogHeader>
                <Form {...resetForm}>
                  <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                    <FormField
                      control={resetForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Correo electrónico</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="correo@ejemplo.com"
                              type="email"
                              autoCapitalize="none"
                              autoComplete="email"
                              autoCorrect="off"
                              disabled={isResetting}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResetDialog(false)}
                        disabled={isResetting}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isResetting}>
                        {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar enlace
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>
      </Form>

      {/* <div className="mt-4 space-y-2">
        <h3 className="text-sm font-medium text-center">Usuarios de prueba</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              form.setValue("email", "user@demo.com")
              form.setValue("password", "user123")
            }}
            type="button"
          >
            Usuario
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              form.setValue("email", "club@elite.com")
              form.setValue("password", "club123")
            }}
            type="button"
          >
            Club
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              form.setValue("email", "admin@canchas.com")
              form.setValue("password", "admin123")
            }}
            type="button"
          >
            Admin
          </Button>
        </div>
      </div> */}

      {/* <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">O continuar con</span>
        </div>
      </div> */}

      {/* <Button variant="outline" type="button" onClick={handleGoogleSignIn} disabled={isLoading || showGoogleLoading}>
        {showGoogleLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="mr-2 h-4 w-4"
            aria-hidden="true"
            focusable="false"
            data-prefix="fab"
            data-icon="google"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
        )}
        Google
      </Button> */}
    </div>
  )
}
