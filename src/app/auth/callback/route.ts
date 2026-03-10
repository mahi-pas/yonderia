import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const siteUrl = await getSiteUrl();
  const redirectTo = sanitizeRedirectPath(requestUrl.searchParams.get("redirectTo"), siteUrl);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/", siteUrl);
      loginUrl.searchParams.set("error", "auth_callback_failed");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(redirectTo, siteUrl));
}
