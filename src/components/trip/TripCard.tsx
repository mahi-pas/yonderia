import Image from "next/image";
import Link from "next/link";
import { buildProfileHref } from "@/lib/trip-navigation";
import { formatTripDateRange } from "@/lib/utils";

type TripCardParticipant = {
  avatarUrl: string | null;
  displayName: string | null;
  userId: string;
};

type TripCardProps = {
  endDate: string;
  id: string;
  imageUrl: string | null;
  locationName: string | null;
  name: string;
  participants: TripCardParticipant[];
  startDate: string;
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function TripCard({
  endDate,
  id,
  imageUrl,
  locationName,
  name,
  participants,
  startDate,
}: TripCardProps) {
  const visibleParticipants = participants.slice(0, 4);

  return (
    <article className="card-hover group relative overflow-hidden border-2 sm:border-4 border-[#121212] bg-white shadow-[4px_4px_0px_0px_black] sm:shadow-[8px_8px_0px_0px_black]">
      <Link
        aria-label={`Open ${name}`}
        className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D02020]"
        href={`/trip/${id}`}
      />

      <div className="pointer-events-none relative z-10">
        <div className="relative aspect-[16/11] overflow-hidden bg-[#E0E0E0]">
          {imageUrl ? (
            <Image
              alt={`${name} cover`}
              className="object-cover"
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-full items-end bg-[#E0E0E0] p-5">
              <span className="font-display text-6xl font-black uppercase text-[#121212]/10">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="border-t-2 border-[#121212] p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">
              {formatTripDateRange(startDate, endDate)}
            </p>
            <h3 className="font-display text-2xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-3xl">{name}</h3>
            <p className="min-h-6 text-sm font-medium text-[#888888]">{locationName || "Location coming together"}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="pointer-events-auto flex items-center">
              {visibleParticipants.map((participant, index) => {
                const label = participant.displayName || "Trip friend";

                return (
                  <div
                    key={participant.userId}
                    className="-ml-2 first:ml-0"
                    style={{ zIndex: visibleParticipants.length - index }}
                  >
                    <Link
                      aria-label={`View ${label}'s profile`}
                      className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D02020]"
                      href={buildProfileHref(participant.userId, `/trip/${id}`)}
                    >
                      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[#121212] bg-[#F0C020] text-sm font-bold text-[#121212]">
                        {participant.avatarUrl ? (
                          <Image
                            alt={label}
                            className="object-cover"
                            fill
                            sizes="44px"
                            src={participant.avatarUrl}
                          />
                        ) : (
                          <span>{getInitials(label || "Y")}</span>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="text-right">
              <p className="text-lg font-black text-[#121212]">{participants.length}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-[#888888]">
                {participants.length === 1 ? "traveler" : "travelers"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
