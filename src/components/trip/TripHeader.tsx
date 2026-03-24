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
      <h1 className="font-display text-center text-3xl font-black uppercase leading-[0.9] tracking-tighter text-[var(--foreground)] sm:text-4xl lg:text-5xl">
        {name}
      </h1>

      <div className="relative w-full overflow-hidden border-2 sm:border-4 border-[#121212] bg-[#E0E0E0]">
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
          <div className="aspect-[16/10] w-full bg-[#E0E0E0] sm:aspect-[21/9]" />
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground)] sm:text-sm">
            {formatTripDateRange(startDate, endDate)}
          </p>
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] sm:text-base">
            <PinIcon className="h-4 w-4 shrink-0 text-[#D02020]" />
            <span>{locationName || "Location coming together"}</span>
          </p>
        </div>
        {canEdit && tripId ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              aria-label="Edit trip"
              className="inline-flex h-10 w-10 items-center justify-center border-2 border-[#121212] bg-white text-[#121212] shadow-[3px_3px_0px_0px_black] transition duration-200 hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]"
              href={`/trip/${tripId}/edit`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              aria-label="Edit theme"
              className="inline-flex h-10 w-10 items-center justify-center border-2 border-[#121212] bg-white text-[#121212] shadow-[3px_3px_0px_0px_black] transition duration-200 hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]"
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
