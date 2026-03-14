// ---------------------------------------------------------------------------
// Internal API Fetch Client
// Typed wrapper for calling our own Next.js API routes from React Query hooks.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Typed fetch wrapper for internal API calls.
 * In mock mode the middleware auto-injects tenant headers,
 * so client-side calls need no special auth setup.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (body as Record<string, string>).error ?? `Request failed (${res.status})`,
    );
  }

  return res.json() as Promise<T>;
}
