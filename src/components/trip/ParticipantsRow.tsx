"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildProfileHref } from "@/lib/trip-navigation";

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
          <p className="text-xs font-semibold tracking-wide uppercase text-[var(--foreground)]">
            Travelers
          </p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[var(--foreground)]">Who&apos;s in</h2>
        </div>
        <p className="text-sm text-[var(--foreground)]/90">{participants.length} total</p>
      </div>

      <div
        className="touch-pan-x overflow-x-auto overscroll-x-contain px-4 py-4 [scrollbar-width:none] [-ms-overflow-style:none]"
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
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elevated)] text-lg font-semibold text-[var(--surface-foreground,var(--muted-foreground))] shadow-[0_4px_16px_rgba(0,0,0,0.2)] ring-1 ring-[var(--accent)]/20">
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
                    <div
                      className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs shadow-sm ${
                        participant.role === "organizer"
                          ? "border-[var(--border)] bg-[var(--gold)] text-[var(--background)]"
                          : "border-[var(--border)] bg-[var(--accent)] text-[var(--foreground)]"
                      }`}
                    >
                      {badge}
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-[var(--foreground)]/90">
                  {participant.name}
                </p>
              </div>
            );

            if (showProfileLinks && participant.profilePath) {
              const profileUserId = participant.profilePath.match(/^\/profile\/([^/?#]+)/)?.[1];
              const profileHref = profileUserId
                ? buildProfileHref(profileUserId, `/trip/${tripId}`)
                : participant.profilePath;

              return (
                <Link
                  key={`${participant.profilePath}-${participant.name}`}
                  className="block snap-start"
                  href={profileHref}
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
              className="flex h-[92px] w-[92px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)]/50 text-center transition hover:bg-[var(--surface-elevated)]"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/trip/${tripId}/participants`);
              }}
            >
              <span className="font-display text-3xl leading-none text-[var(--accent)]">
                +{participants.length}
              </span>
              <span className="mt-1 text-xs font-semibold tracking-wide uppercase text-[var(--surface-foreground,var(--muted-foreground))]">
                See all
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
