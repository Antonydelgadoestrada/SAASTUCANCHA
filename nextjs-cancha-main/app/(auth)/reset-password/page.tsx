"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

const schema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: values.password,
        }),
      })

      if (!res.ok) throw new Error()

      toast.success("Contraseña restablecida correctamente")
      router.push("/login")
    } catch {
      toast.error("Error al restablecer la contraseña")
    }
  }

  if (!token) {
    return <p className="text-center mt-10 text-red-500">Token inválido o faltante.</p>
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-xl font-semibold mb-4">Restablecer contraseña</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nueva contraseña</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Restablecer
          </Button>
        </form>
      </Form>
    </div>
  )
}
