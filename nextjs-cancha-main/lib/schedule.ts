import api from "./axios"

export const getByCourt = async(startDate:string,endDate:string,courtId:string) =>{
    const result = await api.get("/schedule-templates/court-schedule",{
        params: {
            courtId,
            startDate,
            endDate,
          },
    });
    return result.data 
}

export const bulkUpdate = async(slotsToUpdate:any) =>{
    const result = await api.post("/schedule-templates/bulk-update", {items: slotsToUpdate});
    return result.data 
}

export const createSchedule = async(data:any)=>{
    const result = await api.post("/schedule-templates", data);
    return result.data 
}

export const editTemplate = async (data: {
  id: string
  name?: string
  description?: string
  days?: string[]
  slots?: { time: string; status: string }[]
  venueId?: number | null
}) => {
  const { id, ...rest } = data
  const body: Record<string, unknown> = {}
  if (rest.name !== undefined) body.name = rest.name
  if (rest.description !== undefined) body.description = rest.description
  if (rest.days !== undefined) body.days = rest.days
  if (rest.slots !== undefined) body.slots = rest.slots
  if (rest.venueId !== undefined) body.venueId = rest.venueId
  const result = await api.put(`/schedule-templates/${id}`, body)
  return result.data
}

export const getTemplateByClub = async ()=>{
    let url = `/schedule-templates/`
    const result = await api.get(url);
    return result.data
}

export const applyTemplateToCourtSafe = async(template:any, court:any)=>{
    let url = `/schedule-templates/applyTemplateToCourtSafe`
    const result = await api.post(url, {template, court});
    return result.data;
}

export type CourtTemplateByCourtResponse = {
  template: unknown | null
  linkedTemplateId: string | null
}

/** Normaliza la respuesta de `GET /schedule-templates/by-court/:id` (envuelta o legacy). */
export function parseCourtTemplateByCourtResponse(data: unknown): CourtTemplateByCourtResponse {
  if (data == null) return { template: null, linkedTemplateId: null }
  if (typeof data === "object" && data !== null && "linkedTemplateId" in data) {
    const o = data as { template?: unknown; linkedTemplateId?: string | null }
    return {
      template: o.template ?? null,
      linkedTemplateId:
        o.linkedTemplateId != null && o.linkedTemplateId !== ""
          ? String(o.linkedTemplateId)
          : null,
    }
  }
  return { template: data, linkedTemplateId: null }
}

export const getTemplateByCourtId = async (courtId: string) => {
  const result = await api.get(`/schedule-templates/by-court/${courtId}`)
  return result.data
}

/** Slots virtuales con status `event` para un rango de fechas (requiere JWT). */
export const getCourtScheduleEvents = async (
  courtId: string,
  startDate: string,
  endDate: string,
) => {
  const result = await api.get(`/court-schedule-events/court/${courtId}`, {
    params: { startDate, endDate },
  });
  return result.data;
};

/** Filas de `court_schedule_event` para una cancha (gestión en UI). */
export const listCourtScheduleEvents = async (courtId: string) => {
  const result = await api.get(`/court-schedule-events/court/${courtId}/list`);
  return result.data;
};

export type CreateCourtScheduleEventPayload = {
  courtId: string;
  templateId?: string | null;
  name: string;
  description?: string;
  recurrenceType: "weekly" | "monthly" | "custom";
  recurrenceConfig: Record<string, unknown>;
  timeRanges: { start: string; until: string }[];
  price?: number;
  isActive?: boolean;
};

export const createCourtScheduleEvent = async (body: CreateCourtScheduleEventPayload) => {
  const result = await api.post("/court-schedule-events", body);
  return result.data;
};

export const deleteCourtScheduleEvent = async (eventId: string) => {
  const result = await api.delete(`/court-schedule-events/${eventId}`);
  return result.data;
};

export const updateCourtScheduleEvent = async (eventId: string, body: Partial<CreateCourtScheduleEventPayload>) => {
  const result = await api.patch(`/court-schedule-events/${eventId}`, body);
  return result.data;
};