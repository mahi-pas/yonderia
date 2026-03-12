import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { Profile } from "@/lib/types";
import OnboardingModal from "@/components/auth/OnboardingModal";
import { proxy } from "@/proxy";
import { createServerClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: vi.fn(async () => "http://localhost:3000"),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(({ request }: { request: NextRequest }) => ({
      cookies: {
        set: vi.fn(),
      },
      request,
      type: "next",
    })),
    redirect: vi.fn((url: URL) => ({
      cookies: {
        set: vi.fn(),
      },
      location: url.toString(),
      type: "redirect",
    })),
  },
}));

type MockResponse = {
  location?: string;
  type: "next" | "redirect";
};

const createServerClientMock = vi.mocked(createServerClient);

function createRequest(pathnameWithQuery: string): NextRequest {
  const nextUrl = new URL(`http://localhost:3000${pathnameWithQuery}`);

  return {
    cookies: {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    },
    nextUrl,
    url: nextUrl.toString(),
  } as unknown as NextRequest;
}

function createAuthClient(user: User | null) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user },
      })),
    },
  };
}

describe("proxy auth redirects", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  it("redirects unauthenticated users from /dashboard to /", async () => {
    createServerClientMock.mockReturnValue(createAuthClient(null) as never);

    const response = (await proxy(createRequest("/dashboard"))) as MockResponse;

    expect(response.type).toBe("redirect");
    expect(response.location).toBe("http://localhost:3000/?redirectTo=%2Fdashboard");
  });

  it("does not redirect unauthenticated users from /trip/[tripId]", async () => {
    createServerClientMock.mockReturnValue(createAuthClient(null) as never);

    const response = (await proxy(createRequest("/trip/trip-123"))) as MockResponse;

    expect(response.type).toBe("next");
  });

  it("preserves query params when redirecting to login", async () => {
    createServerClientMock.mockReturnValue(createAuthClient(null) as never);

    const response = (await proxy(
      createRequest("/dashboard?code=join-code-123"),
    )) as MockResponse;

    expect(response.type).toBe("redirect");
    expect(response.location).toBe(
      "http://localhost:3000/?redirectTo=%2Fdashboard%3Fcode%3Djoin-code-123",
    );
  });
});

describe("OnboardingModal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderModal(options?: {
    onCompleted?: (profile: Profile) => void;
    profile?: Profile;
  }) {
    const profile: Profile = options?.profile ?? {
      avatar_url: null,
      created_at: "2026-03-10T00:00:00.000Z",
      display_name: null,
      email: "traveler@example.com",
      has_completed_onboarding: false,
      id: "user-123",
    };
    const updatedProfile: Profile = {
      ...profile,
      display_name: "Mahi",
      has_completed_onboarding: true,
    };
    const single = vi.fn(async () => ({
      data: updatedProfile,
      error: null,
    }));
    const select = vi.fn(() => ({
      single,
    }));
    const eq = vi.fn(() => ({
      select,
    }));
    const update = vi.fn(() => ({
      eq,
    }));
    const supabase = {
      from: vi.fn(() => ({
        update,
      })),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(),
          upload: vi.fn(),
        })),
      },
    };
    const onCompleted = vi.fn(options?.onCompleted);
    const user = {
      email: profile.email,
      id: profile.id,
    } as User;

    await act(async () => {
      root.render(
        createElement(OnboardingModal, {
          onCompleted,
          profile,
          supabase: supabase as never,
          user,
        }),
      );
    });

    return {
      onCompleted,
      single,
      update,
      updatedProfile,
    };
  }

  it("updates the profile and completes onboarding on save", async () => {
    const { onCompleted, update, updatedProfile } = await renderModal();
    const nameInput = container.querySelector('input[type="text"]');
    const saveButton = container.querySelector('button[type="button"]');

    if (!nameInput || !saveButton) {
      throw new Error("Expected onboarding form controls to render.");
    }

    await act(async () => {
      const inputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;

      inputValueSetter?.call(nameInput, "Mahi");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledWith({
      avatar_url: null,
      display_name: "Mahi",
      has_completed_onboarding: true,
    });
    expect(onCompleted).toHaveBeenCalledWith(updatedProfile);
  });
});
