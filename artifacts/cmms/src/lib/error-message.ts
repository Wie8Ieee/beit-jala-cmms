export function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) return message;

  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const apiError = (data as { error?: unknown }).error;
    if (typeof apiError === "string" && apiError.trim()) return apiError;
  }

  return fallback;
}
