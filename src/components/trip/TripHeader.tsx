import Image from "next/image";
import { formatTripDateRange } from "@/lib/utils";

type TripHeaderProps = {
  endDate: string;
  imageUrl: string | null;
  locationName: string | null;
  name: string;
  startDate: string;
};

export default function TripHeader({
  endDate,
  imageUrl,
  locationName,
  name,
  startDate,
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
