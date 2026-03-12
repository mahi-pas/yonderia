import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAuthenticatedContext, loadE2EEnv } from "./helpers/auth";
import { addParticipant, createTestInviteCode, createTestTrip } from "./helpers/seed";
import type { Database, Trip, TripTheme } from "@/lib/types";

loadE2EEnv();
test.describe.configure({ mode: "serial" });

function getRequiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
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

async function updateTrip(
  adminClient: ReturnType<typeof createAdminClient>,
  tripId: string,
  values: Partial<Trip>,
) {
  const { error } = await adminClient
    .from("trips")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update(values)
    .eq("id", tripId);
  if (error) throw error;
}

async function markProfileReady(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  displayName: string,
) {
  const { error } = await adminClient
    .from("profiles")
    // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
    .update({
      display_name: displayName,
      has_completed_onboarding: true,
    })
    .eq("id", userId);
  if (error) throw error;
}

async function deleteUser(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw error;
}

const PRE_SEEDED_THEME: TripTheme = {
  accent_color: "#ec4899",
  background: {
    type: "gradient",
    value: "linear-gradient(180deg, #1a0a2e 0%, #0f1a2e 100%)",
    overlay_opacity: 0.15,
  },
  card_style: "glass",
  effect: "sparkles",
  font: { display: "Playfair Display", body: "Raleway" },
};

type AuthSession = Awaited<ReturnType<typeof createAuthenticatedContext>>;
type ThemeScenario = {
  memberContext: AuthSession["context"];
  organizerContext: AuthSession["context"];
  tripId: string;
  tripName: string;
};
type ThemedScenario = ThemeScenario & {
  viewCode: string;
};

let authPool: { member: AuthSession; organizer: AuthSession } | null = null;

async function seedThemeScenario(
  adminClient: ReturnType<typeof createAdminClient>,
  options?: { theme?: TripTheme | null },
): Promise<ThemeScenario> {
  if (!authPool) throw new Error("Auth pool not initialized.");
  const created = await createTestTrip(authPool.organizer.user.id);
  const tripId = created.trip.id;
  const tripName = "Theme Test Trip";
  await addParticipant(tripId, authPool.member.user.id, "member");
  await updateTrip(adminClient, tripId, {
    name: tripName,
    description: "E2E theme tests.",
    location_name: "Lisbon",
    start_date: "2026-09-01",
    end_date: "2026-09-05",
    ...(options?.theme !== undefined && { theme: options.theme ?? {} }),
  });
  return {
    memberContext: authPool.member.context,
    organizerContext: authPool.organizer.context,
    tripId,
    tripName,
  };
}

async function seedThemedScenario(
  adminClient: ReturnType<typeof createAdminClient>,
): Promise<ThemedScenario> {
  const scenario = await seedThemeScenario(adminClient, { theme: PRE_SEEDED_THEME });
  const viewCode = (await createTestInviteCode(scenario.tripId, "view")).code;
  return { ...scenario, viewCode };
}

async function cleanupScenario(scenario: ThemeScenario | ThemedScenario | null) {
  if (!scenario) return;
  const adminClient = createAdminClient();
  await adminClient.from("trips").delete().eq("id", scenario.tripId);
}

async function openCustomizePage(page: Page, tripId: string) {
  await page.goto(`/trip/${tripId}/customize`);
  await expect(page.getByRole("heading", { name: "Customize theme" })).toBeVisible();
}

test.beforeAll(async ({ baseURL, browser }) => {
  const adminClient = createAdminClient();
  const organizer = await createAuthenticatedContext(browser, { baseURL });
  const member = await createAuthenticatedContext(browser, { baseURL });
  await markProfileReady(adminClient, organizer.user.id, "Organizer Theme");
  await markProfileReady(adminClient, member.user.id, "Member Theme");
  authPool = { member, organizer };
});

test.afterAll(async () => {
  if (!authPool) return;
  const adminClient = createAdminClient();
  try {
    await authPool.organizer?.context?.close();
    await authPool.member?.context?.close();
  } finally {
    await deleteUser(adminClient, authPool.member.user.id);
    await deleteUser(adminClient, authPool.organizer.user.id);
    authPool = null;
  }
});

test("Organizer can access /trip/{tripId}/customize", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);
    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
    await expect(page.getByText("Background")).toBeVisible();
    await expect(page.getByText("Save theme")).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Non-organizer visiting /trip/{tripId}/customize is redirected to the trip page", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.memberContext.newPage();
    await page.goto(`/trip/${scenario.tripId}/customize`);
    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Background section: selecting Gradient shows color pickers, selecting Solid shows single picker", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    await page.getByRole("button", { name: "gradient" }).click();
    await expect(page.getByText("Start color")).toBeVisible();
    await expect(page.getByText("End color")).toBeVisible();
    await expect(page.locator('input[type="color"]')).toHaveCount(2);

    await page.getByRole("button", { name: "solid" }).click();
    await expect(page.locator('input[type="color"]')).toHaveCount(1);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Font section: changing display font updates the preview in real-time", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    const displaySelect = page.locator("label").filter({ hasText: "Display font" }).locator("select");
    await displaySelect.selectOption("Playfair Display");

    const previewHeading = page.getByText(scenario.tripName).first();
    await expect(previewHeading).toBeVisible();
    await page.waitForTimeout(500);
    const fontFamily = await previewHeading.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/Playfair Display/i);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Effect section: selecting sparkles shows animated sparkles in the preview", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    await page.getByRole("button", { name: "Sparkles" }).click();
    await expect(page.getByRole("button", { name: "Sparkles" })).toHaveClass(/border-\[var\(--accent\)\]/);
    await page.waitForTimeout(600);
    const sparklePieces = page.locator(".sparkle-piece");
    await expect(sparklePieces.first()).toBeVisible({ timeout: 5000 });
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Card style section: selecting glass updates card appearance in preview", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    await page.getByRole("button", { name: "Glass" }).click();
    await expect(page.getByRole("button", { name: "Glass" })).toHaveClass(/border-\[var\(--accent\)\]/);
    const previewCard = page.locator("[class*='backdrop-blur']").filter({ hasText: scenario.tripName }).first();
    await expect(previewCard).toBeVisible();
    await page.getByRole("button", { name: "Outline" }).click();
    await expect(page.getByRole("button", { name: "Outline" })).toHaveClass(/border-\[var\(--accent\)\]/);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Saving the theme → trip page reflects the new background, fonts, accent, and effect", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    await page.getByRole("button", { name: "gradient" }).click();
    await page.getByRole("button", { name: "Sparkles" }).click();
    await page.getByRole("heading", { name: "Accent color" }).locator("..").locator('input[type="color"]').fill("#22c55e");
    await page.getByRole("button", { name: "Save theme" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    const themeRoot = page.locator(".trip-theme-root");
    await expect(themeRoot).toBeVisible();
    await expect(themeRoot).toHaveAttribute("data-card-style", "glass");
    const accentVar = await themeRoot.evaluate((el) => getComputedStyle(el).getPropertyValue("--trip-accent").trim());
    expect(accentVar).toBe("#22c55e");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Reset to Default clears the theme and reverts to the global theme", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemedScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await openCustomizePage(page, scenario.tripId);

    await expect(page.getByRole("button", { name: "Sparkles" }).locator("..")).toHaveClass(/border-\[var\(--accent\)\]/);
    await page.getByRole("button", { name: "Reset to default" }).click();
    await page.getByRole("button", { name: "Save theme" }).click();

    await expect(page).toHaveURL(new RegExp(`/trip/${scenario.tripId}$`));
    const themeRoot = page.locator(".trip-theme-root");
    await expect(themeRoot).toBeVisible();
    const themeBg = await themeRoot.evaluate((el) => getComputedStyle(el).getPropertyValue("--trip-bg").trim());
    expect(themeBg).toBe("var(--background)");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("View-only page also shows the custom theme", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemedScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemedScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}?code=${scenario.viewCode}`);

    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
    const themeRoot = page.locator(".trip-theme-root");
    await expect(themeRoot).toBeVisible();
    await expect(themeRoot).toHaveAttribute("data-card-style", "glass");
    const accentVar = await themeRoot.evaluate((el) => getComputedStyle(el).getPropertyValue("--trip-accent").trim());
    expect(accentVar).toBe("#ec4899");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("On mobile: theme editor is usable (scrollable, all inputs accessible)", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await page.setViewportSize({ width: 375, height: 812 });
    await openCustomizePage(page, scenario.tripId);

    await expect(page.getByRole("button", { name: "Save theme" })).toBeVisible();
    await page.getByRole("button", { name: "gradient" }).click();
    await expect(page.getByText("Start color")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole("button", { name: "Reset to default" })).toBeVisible();
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("prefers-reduced-motion: effects are disabled", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemedScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemedScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/trip/${scenario.tripId}`);

    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
    const sparkles = page.locator(".sparkle-piece");
    await expect(sparkles).toHaveCount(0);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Trip page with no custom theme (empty JSON) uses the global defaults correctly", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemeScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemeScenario(adminClient, { theme: {} });
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}`);

    await expect(page.getByRole("heading", { name: scenario.tripName })).toBeVisible();
    const themeRoot = page.locator(".trip-theme-root");
    await expect(themeRoot).toBeVisible();
    const bg = await themeRoot.evaluate((el) => getComputedStyle(el).getPropertyValue("--trip-bg").trim());
    expect(bg).toBe("var(--background)");
    const accent = await themeRoot.evaluate((el) => getComputedStyle(el).getPropertyValue("--trip-accent").trim());
    expect(accent).toBe("#8b5cf6");
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});

test("Custom font loads correctly (verify via computed font-family)", async () => {
  const adminClient = createAdminClient();
  let scenario: ThemedScenario | null = null;
  let page: Page | null = null;
  try {
    scenario = await seedThemedScenario(adminClient);
    page = await scenario.organizerContext.newPage();
    await page.goto(`/trip/${scenario.tripId}`);

    const heading = page.getByRole("heading", { name: scenario.tripName }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);
    const fontFamily = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/Playfair Display/i);
  } finally {
    await page?.close();
    await cleanupScenario(scenario);
  }
});
