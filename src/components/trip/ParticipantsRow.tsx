"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ParticipantSummary = {
  avatarUrl: string | null;
  name: string;
  profilePath: string | null;
  role: "organizer" | "planner" | "member";
};

type ParticipantsRowProps = {
  participants: ParticipantSummary[];
  showProfileLinks?: boolean;
  showSeeAll?: boolean;
  tripId: string;
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getRoleBadge(role: ParticipantSummary["role"]): string | null {
  if (role === "organizer") {
    return "♛";
  }

  if (role === "planner") {
    return "★";
  }

  return null;
}

export default function ParticipantsRow({
  participants,
  showProfileLinks = true,
  showSeeAll = true,
  tripId,
}: ParticipantsRowProps) {
  const router = useRouter();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">
            Travelers
          </p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Who&apos;s in</h2>
        </div>
        <p className="text-sm text-[#7e5b4c]">{participants.length} total</p>
      </div>

      <div
        className="touch-pan-x overflow-x-auto overscroll-x-contain rounded-[1.75rem] border border-[#f0d5c7] bg-white/75 px-4 py-4 shadow-sm [scrollbar-width:none] [-ms-overflow-style:none]"
        role={showSeeAll ? "button" : undefined}
        style={{ WebkitOverflowScrolling: "touch" }}
        tabIndex={showSeeAll ? 0 : undefined}
        onClick={() => {
          if (showSeeAll) {
            router.push(`/trip/${tripId}/participants`);
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && showSeeAll) {
            event.preventDefault();
            router.push(`/trip/${tripId}/participants`);
          }
        }}
      >
        <div className="flex min-w-max snap-x snap-mandatory items-start gap-4 pr-1">
          {participants.map((participant) => {
            const badge = getRoleBadge(participant.role);
            const content = (
              <div className="w-[4.5rem] shrink-0 snap-start text-center">
                <div className="relative mx-auto h-16 w-16">
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f6c4a7] text-lg font-semibold text-[#5a2b1c] shadow-[0_12px_22px_rgba(116,58,31,0.14)]">
                    {participant.avatarUrl ? (
                      <Image
                        alt={participant.name}
                        className="object-cover"
                        fill
                        sizes="64px"
                        src={participant.avatarUrl}
                      />
                    ) : (
                      <span>{getInitials(participant.name)}</span>
                    )}
                  </div>
                  {badge ? (
                    <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[#3c1f15] text-xs text-[#ffe8c7] shadow-sm">
                      {badge}
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[#563023]">
                  {participant.name}
                </p>
              </div>
            );

            if (showProfileLinks && participant.profilePath) {
              return (
                <Link
                  key={`${participant.profilePath}-${participant.name}`}
                  className="block snap-start"
                  href={participant.profilePath}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {content}
                </Link>
              );
            }

            return <div key={`${participant.name}-${participant.role}-${participant.profilePath ?? "guest"}`}>{content}</div>;
          })}

          {showSeeAll ? (
            <button
              className="flex h-[92px] w-[92px] shrink-0 snap-start flex-col items-center justify-center rounded-[1.5rem] border border-[#e8c3b2] bg-[linear-gradient(180deg,#fff7f2,#ffefe4)] text-center shadow-sm transition hover:border-[#cc7b58] hover:bg-[#fff4ec]"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/trip/${tripId}/participants`);
              }}
            >
              <span className="font-display text-3xl leading-none text-[#4d2619]">
                +{participants.length}
              </span>
              <span className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#9a6a57]">
                See all
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
