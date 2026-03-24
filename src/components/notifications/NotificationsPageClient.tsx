"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { UserNotification } from "@/lib/notifications";

type NotificationsPageClientProps = {
  notifications: UserNotification[];
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getKindLabel(kind: UserNotification["kind"]): string {
  if (kind === "announcement") {
    return "Announcement";
  }

  if (kind === "comment-reactions") {
    return "Reactions";
  }

  if (kind === "event-comment") {
    return "Event comment";
  }

  if (kind === "new-event") {
    return "New event";
  }

  return "Trip comment";
}

const KIND_COLORS: Record<string, string> = {
  announcement: "bg-[#D02020] text-white",
  "comment-reactions": "bg-[#F0C020] text-[#121212]",
  "event-comment": "bg-[#1040C0] text-white",
  "new-event": "bg-[#1040C0] text-white",
  "trip-comment": "bg-[#121212] text-white",
};

export default function NotificationsPageClient({ notifications }: NotificationsPageClientProps) {
  const [localReadIds, setLocalReadIds] = useState<string[]>([]);
  const lastSubmittedUnreadSignature = useRef<string | null>(null);
  const items = useMemo(
    () =>
      notifications.map((notification) =>
        localReadIds.includes(notification.id) ? { ...notification, isRead: true } : notification,
      ),
    [localReadIds, notifications],
  );
  const unreadIds = useMemo(() => items.filter((item) => !item.isRead).map((item) => item.id), [items]);
  const unreadSignature = unreadIds.join("|");

  useEffect(() => {
    if (!unreadSignature || lastSubmittedUnreadSignature.current === unreadSignature) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/notifications/read", {
          body: JSON.stringify({ notificationIds: unreadIds }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          return;
        }

        lastSubmittedUnreadSignature.current = unreadSignature;
        setLocalReadIds((current) => [...new Set([...current, ...unreadIds])]);
        window.dispatchEvent(new CustomEvent("yonderia-notifications-updated"));
      } catch {}
    })();
  }, [unreadIds, unreadSignature]);

  if (items.length === 0) {
    return (
      <section className="border-2 sm:border-4 border-[#121212] bg-white px-6 py-10 text-center shadow-[6px_6px_0px_0px_black]">
        <div className="mx-auto mb-3 h-3 w-3 bg-[#F0C020]" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Notifications</p>
        <h2 className="mt-3 font-display text-3xl font-black uppercase tracking-tighter text-[#121212]">Nothing new yet</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-[#888888]">
          When your trips get new events, comments, reactions, or announcements, they&apos;ll show up
          here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {items.map((notification) => {
        const actorName = notification.actor?.name || "Someone";
        const profileHref = notification.actor ? `/profile/${notification.actor.userId}` : null;

        return (
          <Link
            key={notification.id}
            className={`block border-2 border-[#121212] px-4 py-4 transition duration-200 hover:-translate-y-0.5 sm:px-5 ${
              notification.isRead
                ? "bg-white shadow-[3px_3px_0px_0px_black]"
                : "bg-[#F0C020]/10 shadow-[4px_4px_0px_0px_black]"
            }`}
            href={notification.href}
          >
            <div className="flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#121212] bg-[#F0C020] text-sm font-bold text-[#121212]">
                {notification.actor?.avatarUrl ? (
                  <Image
                    alt={actorName}
                    className="object-cover"
                    fill
                    sizes="48px"
                    src={notification.actor.avatarUrl}
                  />
                ) : (
                  <span>{getInitials(actorName) || "Y"}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${KIND_COLORS[notification.kind] ?? "bg-[#121212] text-white"}`}>
                    {getKindLabel(notification.kind)}
                  </span>
                  <span className="text-xs font-medium text-[#888888]">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                  {!notification.isRead ? <span className="h-2.5 w-2.5 bg-[#D02020]" /> : null}
                </div>

                <h2 className="mt-3 text-lg font-bold text-[#121212]">{notification.title}</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-[#888888]">{notification.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#888888]">
                  <span>{notification.tripName}</span>
                  {profileHref ? <span>by {actorName}</span> : null}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
