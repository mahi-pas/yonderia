import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { Browser, BrowserContext } from "@playwright/test";
import type { Database } from "@/lib/types";

type AuthenticatedContext = {
  context: BrowserContext;
  session: Session;
  user: User;
};

type CreateAuthenticatedContextOptions = {
  baseURL?: string;
  email?: string;
  password?: string;
};

let hasLoadedTestEnv = false;

export function loadE2EEnv(): void {
  if (hasLoadedTestEnv) {
    return;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    hasLoadedTestEnv = true;
    return;
  }

  const envContents = readFileSync(envPath, "utf8");

  for (const rawLine of envContents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  hasLoadedTestEnv = true;
}

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getCookieName(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];

  return `sb-${projectRef}-auth-token`;
}

function encodeSessionCookie(session: Session): string {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

function createAdminClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function createAnonClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function createAuthenticatedContext(
  browser: Browser,
  options: CreateAuthenticatedContextOptions = {},
): Promise<AuthenticatedContext> {
  loadE2EEnv();

  const supabaseUrl = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const adminClient = createAdminClient();
  const anonClient = createAnonClient();
  const email =
    options.email ?? `playwright-${randomUUID()}@yonderia.test`;
  const password = options.password ?? "PlaywrightPassword123!";

  const { data: createdUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: "Playwright Test User",
      },
    });

  if (createUserError) {
    throw createUserError;
  }

  if (!createdUser.user) {
    throw new Error("Supabase did not return a user from admin.createUser.");
  }

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      email,
      type: "magiclink",
    });

  if (linkError) {
    throw linkError;
  }

  const emailOtp = linkData.properties.email_otp;

  const { data: verifyData, error: verifyError } =
    await anonClient.auth.verifyOtp({
      email,
      token: emailOtp,
      type: "magiclink",
    });

  if (verifyError) {
    throw verifyError;
  }

  if (!verifyData.session || !verifyData.user) {
    throw new Error("Supabase did not return a session for the test user.");
  }

  const context = await browser.newContext();

  await context.addCookies([
    {
      name: getCookieName(supabaseUrl),
      value: encodeSessionCookie(verifyData.session),
      url: options.baseURL ?? "http://localhost:3000",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  return {
    context,
    session: verifyData.session,
    user: verifyData.user,
  };
}
