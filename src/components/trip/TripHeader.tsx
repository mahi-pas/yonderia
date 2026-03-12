import Image from "next/image";
import Link from "next/link";
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
    <section className="trip-card relative isolate overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="relative h-[250px] w-full sm:h-[300px] lg:h-[400px]">
        {imageUrl ? (
          <Image
            alt={`${name} header`}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={imageUrl}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.15)_0%,var(--surface)_50%,transparent_70%),linear-gradient(180deg,var(--surface),var(--background))]" />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(10,10,15,0.4)_50%,rgba(10,10,15,0.85)_100%)]" />

        {canEdit && tripId ? (
          <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
            <Link
              aria-label="Edit trip"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)]/80 text-[#fafafa] shadow-sm backdrop-blur transition hover:bg-[var(--surface)]/95 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
              href={`/trip/${tripId}/edit`}
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M4 20h4l10-10a2.121 2.121 0 0 0-3-3L5 17v3Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <path d="m13.5 6.5 4 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
            </Link>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 lg:p-9">
          <div className="max-w-3xl space-y-3 text-[#fafafa]">
            <p className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
              {formatTripDateRange(startDate, endDate)}
            </p>
            <h1 className="font-display text-4xl leading-[0.92] text-balance sm:text-5xl lg:text-6xl text-[#fafafa]">
              {name}
            </h1>
            <p className="text-sm text-[#d4d4d8] sm:text-base">
              {locationName || "Location coming together"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
