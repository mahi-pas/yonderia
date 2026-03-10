import { vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type QueryAction = "select" | "insert" | "update" | "delete" | "upsert";

export type MockQueryResult = {
  count?: number | null;
  data: unknown;
  error: unknown;
  status?: number;
  statusText?: string;
};

type QueuedQueryResult = Partial<MockQueryResult>;

type QueryHistoryEntry = {
  action: QueryAction;
  filters: Array<{ method: string; args: unknown[] }>;
  table: string;
};

const activeMocks = new Set<MockSupabaseClient>();

function normalizeResult(result?: QueuedQueryResult): MockQueryResult {
  return {
    count: result?.count ?? null,
    data: result?.data ?? null,
    error: result?.error ?? null,
    status: result?.status ?? 200,
    statusText: result?.statusText ?? "OK",
  };
}

class QueryBuilder {
  private action: QueryAction = "select";
  private readonly filters: Array<{ method: string; args: unknown[] }> = [];

  readonly delete = vi.fn(() => {
    this.action = "delete";
    return this;
  });

  readonly eq = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "eq", args });
    return this;
  });

  readonly gt = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "gt", args });
    return this;
  });

  readonly gte = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "gte", args });
    return this;
  });

  readonly ilike = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "ilike", args });
    return this;
  });

  readonly in = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "in", args });
    return this;
  });

  readonly insert = vi.fn(() => {
    this.action = "insert";
    return this;
  });

  readonly limit = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "limit", args });
    return this;
  });

  readonly lt = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "lt", args });
    return this;
  });

  readonly lte = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "lte", args });
    return this;
  });

  readonly match = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "match", args });
    return this;
  });

  readonly maybeSingle = vi.fn(() => this.execute());

  readonly neq = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "neq", args });
    return this;
  });

  readonly not = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "not", args });
    return this;
  });

  readonly order = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "order", args });
    return this;
  });

  readonly select = vi.fn((...args: unknown[]) => {
    this.filters.push({ method: "select", args });
    return this;
  });

  readonly single = vi.fn(() => this.execute());

  readonly update = vi.fn(() => {
    this.action = "update";
    return this;
  });

  readonly upsert = vi.fn(() => {
    this.action = "upsert";
    return this;
  });

  constructor(
    private readonly table: string,
    private readonly resolveQuery: (
      table: string,
      action: QueryAction,
      historyEntry: QueryHistoryEntry,
    ) => MockQueryResult,
  ) {}

  then<TResult1 = MockQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: MockQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: unknown) => TResult | PromiseLike<TResult>)
      | null,
  ): Promise<MockQueryResult | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<MockQueryResult> {
    return this.execute().finally(onfinally ?? undefined);
  }

  private async execute(): Promise<MockQueryResult> {
    return this.resolveQuery(this.table, this.action, {
      action: this.action,
      filters: [...this.filters],
      table: this.table,
    });
  }
}

export class MockSupabaseClient {
  private authUser: User | null = null;
  private readonly history: QueryHistoryEntry[] = [];
  private readonly queryQueue = new Map<string, MockQueryResult[]>();

  readonly auth = {
    getUser: vi.fn(async () => ({
      data: { user: this.authUser },
      error: null,
    })),
  };

  readonly from = vi.fn((table: string) => {
    return new QueryBuilder(table, this.resolveQuery.bind(this));
  });

  readonly storage = {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(),
      download: vi.fn(),
      getPublicUrl: vi.fn(),
      list: vi.fn(),
      remove: vi.fn(),
      upload: vi.fn(),
    })),
  };

  constructor() {
    activeMocks.add(this);
  }

  getHistory(): QueryHistoryEntry[] {
    return [...this.history];
  }

  queueQuery(
    table: string,
    action: QueryAction,
    result: QueuedQueryResult,
  ): void {
    const key = `${table}:${action}`;
    const existing = this.queryQueue.get(key) ?? [];
    existing.push(normalizeResult(result));
    this.queryQueue.set(key, existing);
  }

  reset(): void {
    this.authUser = null;
    this.history.length = 0;
    this.queryQueue.clear();
    this.auth.getUser.mockClear();
    this.from.mockClear();
    this.storage.from.mockClear();
  }

  setAuthUser(user: User | null): void {
    this.authUser = user;
  }

  toClient<TDatabase = unknown>(): SupabaseClient<TDatabase> {
    return this as unknown as SupabaseClient<TDatabase>;
  }

  private resolveQuery(
    table: string,
    action: QueryAction,
    historyEntry: QueryHistoryEntry,
  ): MockQueryResult {
    this.history.push(historyEntry);

    const key = `${table}:${action}`;
    const queued = this.queryQueue.get(key);

    if (!queued || queued.length === 0) {
      return normalizeResult();
    }

    return queued.shift() ?? normalizeResult();
  }
}

export function createSupabaseMock(): MockSupabaseClient {
  return new MockSupabaseClient();
}

export function resetSupabaseMocks(): void {
  for (const mock of activeMocks) {
    mock.reset();
  }
}
