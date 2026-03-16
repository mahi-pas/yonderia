import Link from "next/link";
import { Palette, Pencil } from "lucide-react";
import { formatTripDateRange } from "@/lib/utils";

type TripHeaderProps = {
  canEdit?: boolean;
  endDate: string;
  imageUrl: string | null;
  locationName: string | null;
  name: string;
  startDate: string;
  tripId?: string;
};

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function TripHeader({
  canEdit = false,
  endDate,
  imageUrl,
  locationName,
  name,
  startDate,
  tripId,
}: TripHeaderProps) {
  return (
    <header className="relative space-y-4 sm:space-y-5">
      <h1 className="font-display text-center text-2xl font-bold leading-tight text-balance text-[var(--foreground)] sm:text-3xl lg:text-4xl">
        {name}
      </h1>

      <div className="relative w-full overflow-hidden bg-[var(--surface)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${name} header`}
            className="block h-auto w-full"
            decoding="async"
            fetchPriority="high"
            src={imageUrl}
          />
        ) : (
          <div className="aspect-[16/10] w-full bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.15)_0%,var(--surface)_50%,transparent_70%),linear-gradient(180deg,var(--surface),var(--background))] sm:aspect-[21/9]" />
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-sm">
            {formatTripDateRange(startDate, endDate)}
          </p>
          <p className="flex items-center gap-2 text-sm text-[var(--muted)] sm:text-base">
            <PinIcon className="h-4 w-4 shrink-0 text-[var(--muted)] sm:h-4.5 sm:w-4.5" />
            <span>{locationName || "Location coming together"}</span>
          </p>
        </div>
        {canEdit && tripId ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              aria-label="Edit trip"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 sm:h-10 sm:w-10"
              href={`/trip/${tripId}/edit`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              aria-label="Edit theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm transition hover:bg-[var(--surface)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 sm:h-10 sm:w-10"
              href={`/trip/${tripId}/customize`}
            >
              <Palette className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
