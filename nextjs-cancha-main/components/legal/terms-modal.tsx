"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShieldCheck, DollarSign, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TermsModalProps {
  triggerText?: string
  className?: string
}

export function TermsModal({
  triggerText = "Términos y Condiciones",
  className = "text-primary underline hover:text-primary/80 font-medium inline cursor-pointer",
}: TermsModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <span
          className={className}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(true)
          }}
        >
          {triggerText}
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold">
              Términos, Condiciones y Políticas Financieras
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Última actualización: Septiembre 2026 • Plataforma TuCancha
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-foreground/90 py-4 leading-relaxed">
          {/* Alerta de Transacciones Financieras */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <DollarSign className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-100">
                  Transparencia sobre Manejo de Dinero y Reservas Deportivas
                </p>
                <p>
                  TuCancha facilita la contratación, señas, cobros y pagos de alquiler de canchas deportivas. Al operar en la plataforma, tanto usuarios como clubes asumen compromisos comerciales vinculantes sobre cancelaciones, reservas confirmadas y reembolsos.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground text-base">1. Naturaleza del Servicio</h4>
            <p className="text-muted-foreground text-xs sm:text-sm">
              TuCancha es una plataforma tecnológica que conecta a deportistas y usuarios con complejos deportivos y clubes. TuCancha no es propietaria de las instalaciones físicas, actuando como intermediario tecnológico para la gestión de horarios, disponibilidad y procesamiento de pagos o señas.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground text-base">2. Precios, Tarifas y Transacciones Monetarias</h4>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground text-xs sm:text-sm">
              <li>
                <strong>Fijación de Tarifas:</strong> Los precios por turno de 30 o 60 minutos (incluyendo tarifas diurnas, nocturnas o promocionales) son fijados directamente por cada club deportivo.
              </li>
              <li>
                <strong>Modalidades de Pago:</strong> La plataforma admite pagos en línea mediante pasarelas seguras (MercadoPago), transferencias y billeteras digitales (Yape, Plin) y pagos manuales en el establecimiento.
              </li>
              <li>
                <strong>Señas y Anticipos:</strong> Cuando se reserve mediante adelanto o seña, el saldo restante deberá ser cancelado en el club previo al ingreso a la cancha. El club se reserva el derecho de admisión si el saldo no es saldado.
              </li>
              <li>
                <strong>Comprobantes de Pago:</strong> En pagos manuales o por billeteras digitales, el usuario se compromete a adjuntar comprobantes genuinos. La carga de comprobantes adulterados causará la cancelación inmediata de la cuenta y acciones legales correspondientes.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground text-base">3. Política de Cancelaciones y Reembolsos</h4>
            <div className="rounded-lg bg-muted/60 p-3 text-xs sm:text-sm space-y-2 text-muted-foreground">
              <p>
                • <strong>Cancelaciones con más de 24 horas de anticipación:</strong> El usuario podrá reprogramar su turno o solicitar reembolso según las políticas comerciales fijadas por el club.
              </p>
              <p>
                • <strong>Cancelaciones con menos de 24 horas o No-Show (Inasistencia):</strong> Debido al costo de oportunidad y bloqueo del horario en la cancha, el club tiene derecho a retener el adelanto o la totalidad de la reserva como penalidad compensatoria.
              </p>
              <p>
                • <strong>Condiciones Climáticas o Fuerza Mayor:</strong> En caso de lluvias torrenciales o fallas técnicas imputables al club, se coordinará la reprogramación prioritaria del turno sin costo adicional.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground text-base">4. Obligaciones y Conducta de los Usuarios</h4>
            <p className="text-muted-foreground text-xs sm:text-sm">
              El usuario se compromete a presentarse puntualmente, respetar las normas internas del club deportivo, hacer uso adecuado de las instalaciones y no ceder horarios reservados a terceros sin previa autorización del club.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-foreground text-base">5. Compromisos de los Clubes Deportivos</h4>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Los clubes registrados garantizan que los horarios publicados en TuCancha son fidedignos y que la cancha estará disponible en las condiciones prometidas (iluminación, limpieza y seguridad) durante el horario contratado.
            </p>
          </section>
        </div>

        <div className="border-t pt-4 flex justify-end">
          <Button variant="default" size="sm" onClick={() => setIsOpen(false)}>
            He Leído y Comprendido los Términos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
