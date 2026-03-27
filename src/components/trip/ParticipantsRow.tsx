"use client";

import Image from "next/image";
import Link from "next/link";
import { avatarImageReferrerPolicy, isGoogleUserContentAvatarUrl } from "@/lib/avatar-image";
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
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--foreground,#121212)]">
            Travelers
          </p>
          <h2 className="mt-1 font-display text-3xl uppercase tracking-tighter font-black leading-[0.9] text-[var(--foreground,#121212)]">Who&apos;s in</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground,#666666)]">{participants.length} total</p>
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
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[#121212] bg-[#F8F8F8] text-lg font-bold text-[#666666] shadow-[4px_4px_0px_0px_black]">
                    {participant.avatarUrl ? (
                      <Image
                        alt={participant.name}
                        className="object-cover"
                        fill
                        referrerPolicy={avatarImageReferrerPolicy}
                        sizes="64px"
                        src={participant.avatarUrl}
                        unoptimized={isGoogleUserContentAvatarUrl(participant.avatarUrl)}
                      />
                    ) : (
                      <span>{getInitials(participant.name)}</span>
                    )}
                  </div>
                  {badge ? (
                    <div
                      className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs shadow-[2px_2px_0px_0px_black] ${
                        participant.role === "organizer"
                          ? "border-[#121212] bg-[#F0C020] text-[#121212]"
                          : "border-[#121212] bg-[var(--accent)] text-white"
                      }`}
                    >
                      {badge}
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-[var(--foreground,#121212)]">
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
              className="flex h-[92px] w-[92px] shrink-0 snap-start flex-col items-center justify-center border-2 border-dashed border-[#121212] bg-[#F8F8F8] text-center transition hover:bg-white"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/trip/${tripId}/participants`);
              }}
            >
              <span className="font-display text-3xl leading-none text-[#D02020]">
                +{participants.length}
              </span>
              <span className="mt-1 text-xs font-bold tracking-widest uppercase text-[var(--trip-paper-muted,#666666)]">
                See all
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
