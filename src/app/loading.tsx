export default function AppLoading() {
  return (
    <main className="page-bg min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <section>
          <div className="space-y-4">
            <div className="h-3 w-28 bg-[#D02020]/20" />
            <div className="h-12 w-3/4 bg-[#E0E0E0]" />
            <div className="h-5 w-full bg-[#E0E0E0]/60" />
            <div className="h-5 w-2/3 bg-[#E0E0E0]/60" />
          </div>
        </section>

        <div className="grid gap-6">
          <section>
            <div className="h-56 animate-pulse border-2 border-[#121212]/10 bg-[#E0E0E0]" />
          </section>
          <section>
            <div className="space-y-3">
              <div className="h-6 w-40 animate-pulse bg-[#D02020]/10" />
              <div className="h-24 animate-pulse border-2 border-[#121212]/10 bg-[#E0E0E0]" />
              <div className="h-24 animate-pulse border-2 border-[#121212]/10 bg-[#E0E0E0]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
