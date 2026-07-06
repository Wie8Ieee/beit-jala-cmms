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

  return (await response.json()) as T;
}
