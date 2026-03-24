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
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/70 px-6 py-10 text-center backdrop-blur-sm">
        <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Notifications</p>
        <h2 className="mt-3 font-display text-3xl text-[#fafafa]">Nothing new yet</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
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
            className={`block rounded-[1.6rem] border px-4 py-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface)]/90 sm:px-5 ${
              notification.isRead
                ? "border-[var(--border)] bg-[var(--surface)]/55"
                : "border-[#8b5cf6]/35 bg-[rgba(33,20,56,0.82)] shadow-[0_12px_40px_rgba(139,92,246,0.12)]"
            }`}
            href={notification.href}
          >
            <div className="flex items-start gap-4">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-sm font-semibold text-[#fafafa]">
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
                  <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {getKindLabel(notification.kind)}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                  {!notification.isRead ? <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> : null}
                </div>

                <h2 className="mt-3 text-lg font-semibold text-[#fafafa]">{notification.title}</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{notification.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
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
