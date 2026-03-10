import Image from "next/image";
import Link from "next/link";
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
    <article className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,251,248,0.96)] shadow-[0_22px_55px_rgba(112,58,34,0.14)] transition hover:-translate-y-1 hover:shadow-[0_30px_65px_rgba(112,58,34,0.18)]">
      <Link
        aria-label={`Open ${name}`}
        className="absolute inset-0 z-0 rounded-[2rem] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd4be]"
        href={`/trip/${id}`}
      />

      <div className="pointer-events-none relative z-10">
        <div className="relative aspect-[16/11] overflow-hidden bg-[linear-gradient(135deg,#ffd9c6,#f4ad83)]">
          {imageUrl ? (
            <Image
              alt={`${name} cover`}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,#fff0e8,transparent_40%),linear-gradient(135deg,#f9c4a7,#eb8d64)] p-5">
              <span className="font-display text-4xl text-white/90">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#2c120b]/55 to-transparent" />
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b56445]">
              {formatTripDateRange(startDate, endDate)}
            </p>
            <h3 className="font-display text-3xl leading-none text-[#34180f]">{name}</h3>
            <p className="min-h-6 text-sm text-[#745344]">{locationName || "Location coming together"}</p>
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
                      className="relative block rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd4be]"
                      href={`/profile/${participant.userId}`}
                    >
                      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[rgba(255,249,245,0.98)] bg-[#f6c4a7] text-sm font-semibold text-[#5a2b1c] shadow-sm">
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
              <p className="text-lg font-semibold text-[#402117]">{participants.length}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#9a6a57]">
                {participants.length === 1 ? "traveler" : "travelers"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
