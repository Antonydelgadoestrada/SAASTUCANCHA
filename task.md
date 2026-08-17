Sitio: tucancha.com.pe
 Proyecto: Plataforma para reservas de canchas deportivas.

# Problema en gestión de horarios (Administrador)
En el panel de administración existe la sección Gestión de Horarios.
Problema detectado:
●	Aparece la opción para agregar o modificar rango de horarios.

●	Pero cuando se intenta ampliar o modificar los horarios el sistema no guarda ni aplica los cambios.

Lo que se necesita:
●	Permitir modificar el rango completo de horarios (ejemplo 6 AM a 12 PM).

●	Permitir crear plantillas de horarios por cancha.

●	Que los cambios se reflejen automáticamente en el calendario.

Ejemplo de uso real:
 Un complejo abre:
●	6 AM – 11 PM

El administrador debe poder configurar eso una sola vez.

---
Sprint 1: Diagnóstico y corrección de gestión de horarios
Objetivo: Que los administradores puedan modificar y guardar horarios correctamente.
Tareas:
•	Revisar y corregir el frontend para enviar datos correctamente.
•	Revisar API/backend que guarda los horarios.
•	Ajustar modelo de datos si los rangos/plantillas no se guardan bien.
•	Sincronizar cambios con el calendario en tiempo real.
Entregables:
•	CRUD de horarios funcional.
•	Posibilidad de crear/modificar rangos completos.
•	Cambios reflejados automáticamente en calendario.
Valor para el cliente: Ya puede gestionar horarios sin fallas.
Tiempo estimado: 1-2 semanas
---


# Bloqueo de horarios por academias o eventos
Muchos complejos tienen academias o clases fijas.
Ejemplo:
 Academia de pádel
 Todos los días 10 AM – 12 PM
Actualmente:
 No hay opción fácil para bloquear estos horarios recurrentes.
Se necesita implementar:
Sistema de bloqueo de horarios
Opciones:
Bloqueo:
●	Por día específico

●	Por semana

●	Por mes

●	Personalizado

Ejemplo:
 Bloquear:
 Lunes a viernes
 10:00 – 12:00
 Todo el mes
Resultado:
 Esos horarios no aparecen disponibles para reserva.

---
Sprint 2: Plantillas de horarios y bloqueos recurrentes
Objetivo: Permitir configurar horarios recurrentes y bloquear rangos específicos.
Tareas:
•	Implementar plantillas de horarios por cancha.
•	Crear sistema de bloqueo de horarios (por día, semana, mes, personalizado).
•	Actualizar vista de calendario para reflejar bloqueos.
Entregables:
•	Plantillas de horarios reutilizables.
•	Horarios bloqueados no disponibles para reservas.
Valor para el cliente: Flexibilidad para academias, clases y eventos recurrentes.
Tiempo estimado: 1-2 semanas
---
