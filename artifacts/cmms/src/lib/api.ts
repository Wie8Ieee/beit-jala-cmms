export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${url}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed with ${response.status}`);
  }

  // DELETE endpoints commonly return 204 (No Content). Trying to parse that
  // empty response as JSON makes a successful delete look like a failure.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
