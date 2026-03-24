"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { avatarImageReferrerPolicy } from "@/lib/avatar-image";
import type { EventRsvp } from "@/lib/types";

type RsvpGoingAvatarsProps = {
  rsvps: EventRsvp[];
  variant?: "compact" | "full";
};

const MAX_VISIBLE_COMPACT = 3;
const MAX_VISIBLE_FULL = 5;

export default function RsvpGoingAvatars({
  rsvps,
  variant = "full",
}: RsvpGoingAvatarsProps) {
  const goingUserIds = useMemo(
    () => [...new Set(rsvps.filter((r) => r.status === "going").map((r) => r.user_id))],
    [rsvps],
  );

  const [profiles, setProfiles] = useState<
    Map<string, { avatar_url: string | null; display_name: string | null }>
  >(new Map());

  useEffect(() => {
    if (goingUserIds.length === 0) {
      queueMicrotask(() => setProfiles(new Map()));
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    type ProfileRow = { id: string; avatar_url: string | null; display_name: string | null };
    supabase
      .from("profiles")
      .select("id, avatar_url, display_name")
      .in("id", goingUserIds)
      .then(({ data, error }) => {
        if (!isMounted || error) return;
        const map = new Map<string, { avatar_url: string | null; display_name: string | null }>();
        for (const row of (data ?? []) as ProfileRow[]) {
          map.set(row.id, { avatar_url: row.avatar_url, display_name: row.display_name });
        }
        setProfiles(map);
      });

    return () => {
      isMounted = false;
    };
  }, [goingUserIds]);

  const maxVisible = variant === "compact" ? MAX_VISIBLE_COMPACT : MAX_VISIBLE_FULL;
  const visibleIds = goingUserIds.slice(0, maxVisible);
  const extraCount = goingUserIds.length - maxVisible;

  if (goingUserIds.length === 0) {
    return null;
  }

  const size = variant === "compact" ? "h-6 w-6" : "h-8 w-8";
  const ring = variant === "compact" ? "ring-1 ring-[var(--surface)]" : "ring-2 ring-[var(--surface)]";
  const overlap = variant === "compact" ? "-ml-1.5 first:ml-0" : "-ml-2 first:ml-0";

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${goingUserIds.length} going: ${visibleIds
        .map((id) => profiles.get(id)?.display_name ?? "Traveler")
        .join(", ")}${extraCount > 0 ? ` and ${extraCount} more` : ""}`}
    >
      <div className="flex items-center">
        {visibleIds.map((userId) => {
          const profile = profiles.get(userId);
          const name = profile?.display_name ?? "Traveler";
          const avatarUrl = profile?.avatar_url ?? null;
          return (
            <div
              key={userId}
              className={`relative shrink-0 overflow-hidden rounded-full bg-[var(--surface-elevated)] ${size} ${ring} ${overlap}`}
              title={name}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy={avatarImageReferrerPolicy}
                  src={avatarUrl}
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[var(--muted)]"
                  style={{ fontSize: variant === "compact" ? "0.5rem" : undefined }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {extraCount > 0 ? (
        <span
          className="text-xs text-[var(--muted)]"
          title={`${extraCount} more going`}
        >
          +{extraCount}
        </span>
      ) : null}
    </div>
  );
}
