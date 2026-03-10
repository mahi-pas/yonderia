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
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(135deg,#f2b493,#cc6f47)] shadow-[0_30px_85px_rgba(95,42,20,0.22)]">
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
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,#ffeadd_0%,rgba(255,234,221,0.4)_30%,transparent_40%),linear-gradient(135deg,#f7c7ac,#d46f46)]" />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,12,7,0.08),rgba(30,12,7,0.26)_45%,rgba(30,12,7,0.74)_100%)]" />

        {canEdit && tripId ? (
          <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
            <Link
              aria-label="Edit trip"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-[#2f1710]/55 text-white shadow-sm backdrop-blur transition hover:bg-[#2f1710]/72"
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
          <div className="max-w-3xl space-y-3 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/78">
              {formatTripDateRange(startDate, endDate)}
            </p>
            <h1 className="font-display text-4xl leading-[0.92] text-balance sm:text-5xl lg:text-6xl">
              {name}
            </h1>
            <p className="text-sm text-white/88 sm:text-base">
              {locationName || "Location coming together"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
