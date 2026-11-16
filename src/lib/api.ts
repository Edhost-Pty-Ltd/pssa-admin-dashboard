export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  details?: unknown;

  constructor(status: number, message: string, fields: Record<string, string> = {}, details?: unknown) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    credentials: "include",
    signal: opts.signal,
    headers: opts.form ? undefined : { "Content-Type": "application/json", Accept: "application/json" },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  };
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "We couldn't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; fields?: Record<string, string>; details?: { fields?: Record<string, string> } };
    throw new ApiError(
      res.status,
      payload.error ?? (res.status >= 500 ? "We couldn't reach the server. Please make sure the backend is running and try again." : `Request failed (${res.status}).`),
      payload.fields ?? payload.details?.fields ?? {},
      payload.details,
    );
  }
  return data as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Something went wrong.";

/** Builds a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
