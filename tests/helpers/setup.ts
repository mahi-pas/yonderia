import { afterEach, beforeEach, vi } from "vitest";
import { resetSupabaseMocks } from "./supabase-mock";

process.env.TZ = "UTC";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

beforeEach(() => {
  resetSupabaseMocks();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  resetSupabaseMocks();
});
