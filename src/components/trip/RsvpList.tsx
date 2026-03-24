"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { avatarImageReferrerPolicy } from "@/lib/avatar-image";
import { useEventRsvps } from "@/hooks/useEventRsvps";
import type { EventRsvp, RsvpStatus } from "@/lib/types";
import Modal from "@/components/ui/Modal";

type RsvpListProps = {
  currentUserId: string | null;
  isOpen: boolean;
  itineraryItemId: string;
  onClose: () => void;
  title?: string;
};

type RsvpWithProfile = EventRsvp & {
  displayName: string | null;
  avatarUrl: string | null;
};

const STATUS_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  interested: "Interested",
  not_going: "Not going",
};

const STATUS_ORDER: RsvpStatus[] = ["going", "interested", "not_going"];

function AvatarRow({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string | null }) {
  const name = displayName ?? "Traveler";
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#F8F8F8] ring-2 ring-[#121212]">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy={avatarImageReferrerPolicy}
            src={avatarUrl}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#888888]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="min-w-0 truncate text-sm font-bold text-[#121212]">{name}</span>
    </div>
  );
}

export default function RsvpList({
  currentUserId,
  isOpen,
  itineraryItemId,
  onClose,
  title = "Who's going",
}: RsvpListProps) {
  const { rsvps } = useEventRsvps({
    enabled: isOpen && Boolean(itineraryItemId) && Boolean(currentUserId),
    itineraryItemId,
    currentUserId,
  });
  const [profiles, setProfiles] = useState<Map<string, { display_name: string | null; avatar_url: string | null }>>(
    new Map(),
  );

  const userIds = useMemo(() => [...new Set(rsvps.map((r) => r.user_id))], [rsvps]);

  useEffect(() => {
    if (!isOpen || userIds.length === 0) {
      queueMicrotask(() => setProfiles(new Map()));
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    type ProfileRow = { id: string; display_name: string | null; avatar_url: string | null };
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds)
      .then(({ data, error }) => {
        if (!isMounted || error) return;
        const map = new Map<string, { display_name: string | null; avatar_url: string | null }>();
        for (const row of (data ?? []) as ProfileRow[]) {
          map.set(row.id, { display_name: row.display_name, avatar_url: row.avatar_url });
        }
        setProfiles(map);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userIds]);

  const grouped = useMemo(() => {
    const withProfile: RsvpWithProfile[] = rsvps.map((r) => {
      const p = profiles.get(r.user_id);
      return {
        ...r,
        displayName: p?.display_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
      };
    });
    const groups: Record<RsvpStatus, RsvpWithProfile[]> = {
      going: [],
      interested: [],
      not_going: [],
    };
    for (const r of withProfile) {
      groups[r.status].push(r);
    }
    return groups;
  }, [rsvps, profiles]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal description="RSVP list for this event" isOpen={isOpen} title={title} onClose={onClose}>
      <div className="space-y-6">
        {STATUS_ORDER.map((status) => {
          const list = grouped[status];
          if (list.length === 0) return null;
          return (
            <div key={status}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
                {STATUS_LABELS[status]} ({list.length})
              </h3>
              <ul className="space-y-2" role="list">
                {list.map((r) => (
                  <li key={r.id}>
                    <AvatarRow avatarUrl={r.avatarUrl} displayName={r.displayName} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {rsvps.length === 0 ? (
          <p className="text-sm font-bold text-[#888888]">No one has responded yet.</p>
        ) : null}
      </div>
    </Modal>
  );
}
