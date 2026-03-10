import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Database, InviteCodeType } from "@/lib/types";

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }

  return value;
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/")
  );
}

function isTripDetailsPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  return segments.length === 2 && segments[0] === "trip";
}

function getTripIdFromPath(pathname: string): string | null {
  if (!isTripDetailsPath(pathname)) {
    return null;
  }

  return pathname.split("/").filter(Boolean)[1] ?? null;
}

function buildLandingRedirectUrl(request: NextRequest, redirectTo?: string): URL {
  const loginUrl = new URL("/", request.url);
  const resolvedRedirectTo = redirectTo ?? request.nextUrl.pathname + request.nextUrl.search;

  loginUrl.searchParams.set("redirectTo", resolvedRedirectTo);

  return loginUrl;
}

function buildAuthStartUrl(request: NextRequest, redirectTo: string): URL {
  const loginUrl = new URL("/auth/login", request.url);

  loginUrl.searchParams.set("redirectTo", redirectTo);

  return loginUrl;
}

async function lookupInviteCodeType(
  tripId: string,
  code: string,
): Promise<InviteCodeType | null> {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = getRequiredEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  const lookupUrl = new URL("/rest/v1/invite_codes", supabaseUrl);

  lookupUrl.searchParams.set("select", "code_type");
  lookupUrl.searchParams.set("trip_id", `eq.${tripId}`);
  lookupUrl.searchParams.set("code", `eq.${code}`);
  lookupUrl.searchParams.set("is_active", "eq.true");
  lookupUrl.searchParams.set("limit", "1");

  const response = await fetch(lookupUrl, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Array<{ code_type?: InviteCodeType }>;
  const inviteCode = data[0];

  return inviteCode?.code_type ?? null;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tripId = getTripIdFromPath(request.nextUrl.pathname);
  const inviteCode = request.nextUrl.searchParams.get("code")?.trim();

  if (!user && tripId && inviteCode) {
    const inviteCodeType = await lookupInviteCodeType(tripId, inviteCode);

    if (inviteCodeType === "join" || inviteCodeType === "join_planner") {
      const redirectTo = `/trip/${tripId}/join?code=${encodeURIComponent(inviteCode)}`;
      return NextResponse.redirect(buildAuthStartUrl(request, redirectTo));
    }
  }

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(buildLandingRedirectUrl(request));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
