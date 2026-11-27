// Client for the dev-server data API (server/plugin.ts).

import type { Annotation, AthleteRegistry, Vocabulary } from "../session/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!res.ok) throw new ApiError(body.error ?? res.statusText, body.details ?? []);
  return body as T;
}

export const api = {
  vocabulary: () => request<Vocabulary>("/api/vocabulary"),
  registry: () => request<AthleteRegistry>("/api/athletes"),
  listAnnotations: () => request<string[]>("/api/annotations"),
  readAnnotation: (id: string) => request<Annotation>(`/api/annotations/${encodeURIComponent(id)}`),
  saveAnnotation: (annotation: Annotation) =>
    request<{ saved: string }>(`/api/annotations/${encodeURIComponent(annotation.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotation),
    }),
};
