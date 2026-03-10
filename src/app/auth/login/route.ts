import { NextResponse } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTo = sanitizeRedirectPath(requestUrl.searchParams.get("redirectTo"), requestUrl.origin);
  const supabase = await createClient();
  const callbackUrl = new URL("/auth/callback", requestUrl.origin);

  callbackUrl.searchParams.set("redirectTo", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/", requestUrl.origin);

    loginUrl.searchParams.set("error", "auth_start_failed");
    loginUrl.searchParams.set("redirectTo", redirectTo);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}
