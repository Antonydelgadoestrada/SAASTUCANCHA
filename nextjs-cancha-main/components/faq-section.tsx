"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpCircle } from "lucide-react"

const clubFaqs = [
  {
    question: "¿Cómo recibo el dinero de mis reservas?",
    answer: "Con Yape o Plin, el 100% es tuyo, sin comisiones. Con Mercado Pago, el dinero ingresa directamente a tu cuenta de MP. Tú tienes el control y eliges qué métodos de pago activar en tu panel."
  },
  {
    question: "¿La prueba gratuita de 30 días tiene algún compromiso?",
    answer: "No. Puedes probar todas las funcionalidades premium de la plataforma sin ingresar tarjeta de crédito ni asumir compromisos de continuidad."
  },
  {
    question: "¿Puedo registrar reservas tomadas por teléfono o presencial?",
    answer: "Sí, el panel te permite cargar tus propias reservas manuales para mantener tu calendario siempre actualizado y bloqueado, sin que estas reservas pasen por la pasarela pública."
  },
  {
    question: "¿Qué pasa si no pago mi membresía después de la prueba?",
    answer: "Tus canchas dejarán de aparecer en el buscador público para recibir nuevas reservas online, pero conservarás el acceso a tu panel administrativo y a todo tu historial de datos. Nada se borra."
  },
  {
    question: "¿Puedo cambiar o cancelar mi plan cuando quiera?",
    answer: "Totalmente. Entendemos que las necesidades de tu club pueden cambiar. Nuestros planes no tienen permanencia forzada ni letras pequeñas."
  },
  {
    question: "¿Tienen planes personalizados o ayuda para eventos y torneos?",
    answer: "Sí. Si necesitas algo a medida (como un plan para múltiples sedes) o apoyo organizando un torneo o evento deportivo, contáctanos directamente. Tenemos experiencia en el ámbito deportivo y te ayudamos a armarlo."
  },
  {
    question: "¿Qué pasa si un cliente cancela su reserva?",
    answer: "Tú tienes el control total. Puedes anular las reservas manuales en cualquier momento o establecer tus propias reglas de cancelación desde tu panel."
  },
  {
    question: "¿Cuánto cuesta si tengo más de una sede?",
    answer: "Cada sede funciona de manera independiente para mantener su propia organización, horarios y reportes financieros separados. Por ello, cada sede requiere su propia membresía activa."
  },
  {
    question: "¿Tengo soporte si tengo dudas o problemas?",
    answer: "Sí, contamos con un equipo de soporte disponible de manera directa vía WhatsApp para ayudarte con cualquier inquietud en todo momento."
  }
]

const playerFaqs = [
  {
    question: "¿Qué pasa si no subo mi comprobante a tiempo al reservar?",
    answer: "El horario se libera automáticamente si no subes la foto de tu comprobante de pago (Yape/Plin) dentro del tiempo límite de gracia indicado en la pantalla."
  },
  {
    question: "¿Qué pasa si ya pagué pero el club demora en confirmar?",
    answer: "Tu reserva está asegurada. Nunca pierdes un horario por el que ya realizaste y adjuntaste el pago exitosamente."
  },
  {
    question: "¿Cómo sé qué métodos de pago acepta una cancha?",
    answer: "Los métodos de pago disponibles (Yape, Plin o Pago con Tarjeta) se muestran de manera muy visible antes de que confirmes tu reserva."
  },
  {
    question: "¿Mis datos y pagos están seguros?",
    answer: "Sí, absolutamente. Toda la información y transacciones viajan a través de una conexión encriptada SSL de alta seguridad y los pagos con tarjeta son procesados por pasarelas certificadas."
  },
  {
    question: "¿Puedo reservar varias fechas a la vez?",
    answer: "Sí, puedes reservar todos los horarios que necesites para tus partidos realizando el proceso de reserva fácil y rápido para cada fecha deseada."
  }
]

export function FaqSection() {
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center space-y-4 mb-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
            <HelpCircle className="h-4 w-4 shrink-0" />
            <span>Centro de Ayuda</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Preguntas Frecuentes
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Resolvemos tus principales dudas sobre TuCancha para que tomes la mejor decisión, ya seas administrador de un club o jugador.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 max-w-6xl mx-auto">
          {/* Columna Clubes */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold border-b pb-4 border-border/40 text-foreground flex items-center gap-2">
              🏢 Para Administradores de Clubes
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {clubFaqs.map((faq, index) => (
                <AccordionItem key={`club-${index}`} value={`club-${index}`}>
                  <AccordionTrigger className="text-left text-base font-semibold hover:text-primary transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Columna Jugadores */}
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold border-b pb-4 border-border/40 text-foreground flex items-center gap-2">
              ⚽ Para Jugadores
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {playerFaqs.map((faq, index) => (
                <AccordionItem key={`player-${index}`} value={`player-${index}`}>
                  <AccordionTrigger className="text-left text-base font-semibold hover:text-primary transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  )
}
