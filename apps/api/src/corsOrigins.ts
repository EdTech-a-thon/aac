export function getCorsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedRedirectUrl(redirectTo: string): boolean {
  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  return getCorsOrigins().includes(url.origin);
}
