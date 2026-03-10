export default function AppLoading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-5 shadow-[0_24px_70px_rgba(104,45,20,0.12)] sm:p-6">
          <div className="space-y-4">
            <div className="h-3 w-28 rounded-full bg-[#f1d5c7]" />
            <div className="h-12 w-3/4 rounded-[1.5rem] bg-[#f6e5dc]" />
            <div className="h-5 w-full rounded-full bg-[#f8ebe2]" />
            <div className="h-5 w-2/3 rounded-full bg-[#f8ebe2]" />
          </div>
        </section>

        <div className="grid gap-5">
          <section className="rounded-[1.75rem] border border-[#efd5c8] bg-white/75 p-5 shadow-sm">
            <div className="h-56 animate-pulse rounded-[1.5rem] bg-[#f6e5dc]" />
          </section>
          <section className="rounded-[1.75rem] border border-[#efd5c8] bg-white/75 p-5 shadow-sm">
            <div className="space-y-3">
              <div className="h-6 w-40 animate-pulse rounded-full bg-[#f6e5dc]" />
              <div className="h-24 animate-pulse rounded-[1.5rem] bg-[#f8ebe2]" />
              <div className="h-24 animate-pulse rounded-[1.5rem] bg-[#f8ebe2]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
