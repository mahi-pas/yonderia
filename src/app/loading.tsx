export default function AppLoading() {
  return (
    <main className="page-bg min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[0_4px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-6">
          <div className="space-y-4">
            <div className="h-3 w-28 rounded-full bg-[#8b5cf6]/10" />
            <div className="h-12 w-3/4 rounded-2xl bg-[var(--surface-elevated)]" />
            <div className="h-5 w-full rounded-full bg-[var(--surface-elevated)]/60" />
            <div className="h-5 w-2/3 rounded-full bg-[var(--surface-elevated)]/60" />
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-5 shadow-sm backdrop-blur-sm">
            <div className="h-56 animate-pulse rounded-2xl bg-[var(--surface-elevated)]" />
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-5 shadow-sm backdrop-blur-sm">
            <div className="space-y-3">
              <div className="h-6 w-40 animate-pulse rounded-full bg-[#8b5cf6]/10" />
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-elevated)]" />
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-elevated)]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
