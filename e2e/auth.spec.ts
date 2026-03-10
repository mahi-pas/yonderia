import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import type { Database } from "@/lib/types";

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

loadE2EEnv();

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

async function deleteUser(userId: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw error;
  }
}

test("Home page shows sign-in button when not authenticated", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", {
      name: "Sign in with Google",
    }),
  ).toBeVisible();
});

test("After sign-in, user is redirected to /dashboard", async ({
  baseURL,
  browser,
}) => {
  const { context, user } = await createAuthenticatedContext(browser, {
    baseURL,
  });

  try {
    const page = await context.newPage();

    await page.goto("/");
    await page.waitForURL("**/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("heading", {
        name: "Dashboard",
      }),
    ).toBeVisible();
  } finally {
    await context.close();
    await deleteUser(user.id);
  }
});

test("First-time user sees the onboarding modal", async ({ baseURL, browser }) => {
  const { context, user } = await createAuthenticatedContext(browser, {
    baseURL,
  });

  try {
    const page = await context.newPage();

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", {
        name: "Make your profile feel like you",
      }),
    ).toBeVisible();
  } finally {
    await context.close();
    await deleteUser(user.id);
  }
});

test("After completing onboarding, the modal does not appear again on next visit", async ({
  baseURL,
  browser,
}) => {
  const { context, user } = await createAuthenticatedContext(browser, {
    baseURL,
  });

  try {
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", {
        name: "Make your profile feel like you",
      }),
    ).toBeVisible();

    await page.getByLabel("Display name").fill("Playwright Explorer");
    await page.getByRole("button", { name: "Save and continue" }).click();

    await expect(
      page.getByRole("heading", {
        name: "Make your profile feel like you",
      }),
    ).toBeHidden();

    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", {
        name: "Make your profile feel like you",
      }),
    ).toHaveCount(0);
  } finally {
    await context.close();
    await deleteUser(user.id);
  }
});

test("Unauthenticated user visiting /dashboard is redirected to home page", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await page.waitForURL("**/?redirectTo=*");
  await expect(page).toHaveURL(/\/\?redirectTo=%2Fdashboard$/);
  await expect(
    page.getByRole("button", {
      name: "Sign in with Google",
    }),
  ).toBeVisible();
});
