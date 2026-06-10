// API base URLs. The browser talks to the public URL; Next.js server
// components reach the backend over the internal compose network.
export const browserApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const serverApiBase =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://backend:8000";

export type Role = { id: string; name: string; description: string };
export type Organization = {
  id: string;
  name: string;
  primary_domain: string;
  display_name?: string;
  logo_url?: string;
  brand_color?: string;
};
export type CurrentUser = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  organization: Organization;
  roles: Role[];
  permissions: string[];
};

// Server-side: fetch the current user, forwarding the incoming cookies.
// Returns null when not authenticated.
export async function fetchCurrentUser(
  cookieHeader: string
): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${serverApiBase}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as CurrentUser;
  } catch {
    return null;
  }
}
