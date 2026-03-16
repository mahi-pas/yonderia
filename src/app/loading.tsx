export default function AppLoading() {
  return (
    <main className="page-bg min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5 animate-fade-in">
        <section className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="h-3 w-28 rounded-full bg-[#8b5cf6]/10" />
            <div className="h-12 w-3/4 rounded-2xl bg-[var(--surface-elevated)]" />
            <div className="h-5 w-full rounded-full bg-[var(--surface-elevated)]/60" />
            <div className="h-5 w-2/3 rounded-full bg-[var(--surface-elevated)]/60" />
          </div>
        </section>

        <div className="grid gap-5">
          <section className="p-5">
            <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-elevated)]" />
          </section>
          <section className="p-5">
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
