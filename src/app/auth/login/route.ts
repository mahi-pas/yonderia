import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = await getSiteUrl();
  const redirectTo = sanitizeRedirectPath(requestUrl.searchParams.get("redirectTo"), siteUrl);
  const supabase = await createClient();
  const callbackUrl = new URL("/auth/callback", siteUrl);

  callbackUrl.searchParams.set("redirectTo", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/", siteUrl);

    loginUrl.searchParams.set("error", "auth_start_failed");
    loginUrl.searchParams.set("redirectTo", redirectTo);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
