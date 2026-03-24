import Link from "next/link";

/** Dashboard card that links to the full-page create trip flow. */
export default function CreateTripFlow() {
  return (
    <Link
      className="group flex min-h-[18rem] w-full flex-col justify-between rounded-2xl border border-dashed border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(20,20,31,0.92),rgba(10,10,15,0.96))] p-5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-px hover:border-[#8b5cf6]/50 hover:shadow-[0_4px_32px_rgba(139,92,246,0.15),0_8px_32px_rgba(0,0,0,0.25)]"
      href="/trips/new"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] text-3xl text-white shadow-[0_2px_20px_rgba(139,92,246,0.3)] transition">
        +
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase gradient-text">Start planning</p>
        <h3 className="font-display text-3xl leading-none text-[#fafafa]">Create New Trip</h3>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Pick the dates, drop in a dreamy cover image, and get invite links ready in one go.
        </p>
      </div>
    </Link>
  );
}
