// court-service — 07-api/contracts/openapi/court-service.yaml
import { apiRequest } from "./client";
import type { Court, DataList, DayOfWeek, Schedule, ScheduleRequest, UpdateCourtRequest } from "./types";

const seg = encodeURIComponent;

export const courtsApi = {
  /** GET /courts — las cuatro canchas (FR-001). Público. */
  async list(): Promise<Court[]> {
    const res = await apiRequest<DataList<Court>>({ method: "GET", path: "/courts" });
    return res.data;
  },

  /** GET /courts/{id}. Público. */
  get(id: string): Promise<Court> {
    return apiRequest<Court>({ method: "GET", path: `/courts/${seg(id)}` });
  },

  /** GET /courts/{id}/schedules — horario semanal (FR-002). Público. */
  async schedules(id: string): Promise<Schedule[]> {
    const res = await apiRequest<DataList<Schedule>>({ method: "GET", path: `/courts/${seg(id)}/schedules` });
    return res.data;
  },

  /** PATCH /admin/courts/{id} (FR-028, FR-030, FR-031). ADMINISTRATOR. */
  update(id: string, body: UpdateCourtRequest): Promise<Court> {
    return apiRequest<Court>({ method: "PATCH", path: `/admin/courts/${seg(id)}`, body, auth: true });
  },

  /** PUT /admin/courts/{id}/schedules/{dayOfWeek} (FR-029). ADMINISTRATOR. */
  putSchedule(id: string, day: DayOfWeek, body: ScheduleRequest): Promise<Schedule> {
    return apiRequest<Schedule>({ method: "PUT", path: `/admin/courts/${seg(id)}/schedules/${day}`, body, auth: true });
  },

  /** DELETE /admin/courts/{id}/schedules/{dayOfWeek} — cierra la cancha ese día (FR-029). */
  deleteSchedule(id: string, day: DayOfWeek): Promise<void> {
    return apiRequest<void>({ method: "DELETE", path: `/admin/courts/${seg(id)}/schedules/${day}`, auth: true });
  },
};
