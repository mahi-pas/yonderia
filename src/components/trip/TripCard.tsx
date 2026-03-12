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
    <article className="card-hover group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15)] backdrop-blur-sm gradient-border-hover">
      <Link
        aria-label={`Open ${name}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/30"
        href={`/trip/${id}`}
      />

      <div className="pointer-events-none relative z-10">
        <div className="relative aspect-[16/11] overflow-hidden bg-[linear-gradient(135deg,var(--surface-elevated),var(--surface))]">
          {imageUrl ? (
            <Image
              alt={`${name} cover`}
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              src={imageUrl}
            />
          ) : (
            <div className="flex h-full items-end bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.15),transparent_40%),linear-gradient(135deg,var(--surface-elevated),var(--surface))] p-5">
              <span className="font-display text-4xl gradient-text">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--background)]/70 to-transparent" />
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide uppercase gradient-text">
              {formatTripDateRange(startDate, endDate)}
            </p>
            <h3 className="font-display text-3xl leading-none text-[#fafafa]">{name}</h3>
            <p className="min-h-6 text-sm text-[var(--muted)]">{locationName || "Location coming together"}</p>
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
                      className="relative block rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8b5cf6]/30"
                      href={`/profile/${participant.userId}`}
                    >
                      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elevated)] text-sm font-semibold text-[var(--muted)] shadow-sm ring-1 ring-[#8b5cf6]/20">
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
              <p className="text-lg font-semibold text-[#fafafa]">{participants.length}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {participants.length === 1 ? "traveler" : "travelers"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
