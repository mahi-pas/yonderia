"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, MapPin, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  LAST_TRIP_UPDATED_EVENT,
  LAST_VIEWED_TRIP_STORAGE_KEY,
} from "@/lib/trip-navigation";
import { useTripNavTheme } from "./TripNavThemeContext";

type AppNavigationProps = {
  mobile?: boolean;
};

type NavItem = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  id: "notifications" | "trips" | "new";
  label: string;
};

const LEFT_NAV_ITEMS: NavItem[] = [
  { href: "/trips/new", icon: Plus, id: "new", label: "New trip" },
  { href: "/dashboard", icon: BriefcaseBusiness, id: "trips", label: "Trips" },
];

const RIGHT_NAV_ITEM: NavItem = {
  href: "/notifications",
  icon: Bell,
  id: "notifications",
  label: "Notifications",
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isSideNavItemActive(pathname: string, itemId: NavItem["id"]): boolean {
  if (itemId === "new") {
    return pathname === "/trips/new";
  }

  if (itemId === "trips") {
    return pathname === "/dashboard";
  }

  return pathname === "/notifications" || pathname.startsWith("/notifications/");
}

function isCurrentTripActive(pathname: string, tripId: string | null): boolean {
  if (!tripId) {
    return false;
  }

  return pathname === `/trip/${tripId}` || pathname.startsWith(`/trip/${tripId}/`);
}

const linkBaseClass =
  "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition";
const linkActiveClass =
  "bg-[image:var(--accent-gradient)] text-white shadow-[0_6px_24px_rgba(139,92,246,0.28)]";
const linkInactiveClass =
  "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]";

export default function AppNavigation({ mobile = false }: AppNavigationProps) {
  const pathname = usePathname();
  const tripNavTheme = useTripNavTheme();
  const { profile, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [currentTripResolved, setCurrentTripResolved] = useState(false);
  const [currentTripFetchOk, setCurrentTripFetchOk] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch("/api/notifications/summary", { cache: "no-store" });

      if (!response.ok) {
        setUnreadCount(0);
        return;
      }

      const payload = (await response.json()) as { unreadCount?: number };
      setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  const loadCurrentTripTarget = useCallback(async () => {
    if (!user) {
      setCurrentTripId(null);
      setCurrentTripFetchOk(false);
      setCurrentTripResolved(true);
      return;
    }

    let hint = "";
    try {
      hint = localStorage.getItem(LAST_VIEWED_TRIP_STORAGE_KEY) ?? "";
    } catch {
      hint = "";
    }

    try {
      const response = await fetch(
        `/api/navigation/current-trip?hint=${encodeURIComponent(hint)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setCurrentTripFetchOk(false);
        setCurrentTripId(null);
        setCurrentTripResolved(true);
        return;
      }

      const payload = (await response.json()) as { tripId?: string | null };
      setCurrentTripFetchOk(true);
      setCurrentTripId(typeof payload.tripId === "string" ? payload.tripId : null);
    } catch {
      setCurrentTripFetchOk(false);
      setCurrentTripId(null);
    } finally {
      setCurrentTripResolved(true);
    }
  }, [user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadUnreadCount();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadUnreadCount, pathname]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrentTripTarget();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadCurrentTripTarget, pathname]);

  useEffect(() => {
    const handleFocus = () => {
      void loadUnreadCount();
    };

    const handleLastTrip = () => {
      void loadCurrentTripTarget();
    };

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 60000);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("yonderia-notifications-updated", handleFocus as EventListener);
    window.addEventListener(LAST_TRIP_UPDATED_EVENT, handleLastTrip);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("yonderia-notifications-updated", handleFocus as EventListener);
      window.removeEventListener(LAST_TRIP_UPDATED_EVENT, handleLastTrip);
    };
  }, [loadCurrentTripTarget, loadUnreadCount]);

  const profileHref = user ? `/profile/${user.id}` : "/dashboard";
  const profileLabel = profile?.display_name?.trim() || "Your profile";
  const profileInitials = getInitials(profileLabel || "Y");
  const profileIsActive = pathname === profileHref;

  const containerClassName = mobile
    ? "fixed inset-x-0 bottom-0 z-50 px-3 pb-safe pt-2 md:hidden"
    : "hidden md:sticky md:top-0 md:z-50 md:block md:w-full";

  const mobileShellClass =
    "mx-auto max-w-lg rounded-[1.75rem] border px-2 py-2 shadow-[0_-10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl " +
    (tripNavTheme
      ? "border-[var(--border-strong)] bg-[var(--surface-elevated)]/92"
      : "border-[var(--border-strong)] bg-[rgba(10,10,15,0.92)]");

  const cardClassName = mobile ? mobileShellClass : "w-full";

  const leftItems = useMemo(() => LEFT_NAV_ITEMS, []);
  const currentTripHref = currentTripId ? `/trip/${currentTripId}` : "/dashboard";
  const currentTripActive = isCurrentTripActive(pathname, currentTripId);

  const newTripButtonClass =
    "inline-flex shrink-0 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_12px_rgba(139,92,246,0.25)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 sm:text-sm sm:px-4 sm:py-2";

  if (!user) {
    return null;
  }

  const renderSideLink = (item: NavItem, layout: "desktop" | "mobile") => {
    const Icon = item.icon;
    const active = isSideNavItemActive(pathname, item.id);
    const layoutClass = layout === "mobile" ? "w-full min-w-0" : "";

    return (
      <Link
        key={item.id}
        aria-label={item.label}
        className={`${linkBaseClass} ${active ? linkActiveClass : linkInactiveClass} ${layoutClass}`}
        href={item.href}
      >
        <span className="relative">
          <Icon className="h-5 w-5" />
          {item.id === "notifications" && unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
        {layout === "desktop" ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
      </Link>
    );
  };

  const renderCurrentTripControl = (layout: "desktop" | "mobile") => {
    const layoutClass = layout === "mobile" ? "w-full min-w-0" : "";

    if (!currentTripResolved) {
      return (
        <span
          aria-label="Loading current trip"
          className={`${linkBaseClass} pointer-events-none text-[var(--muted)] opacity-50 ${layoutClass}`}
        >
          <MapPin className="h-5 w-5" />
          {layout === "desktop" ? <span>Current trip</span> : <span className="sr-only">Current trip</span>}
        </span>
      );
    }

    if (!currentTripFetchOk) {
      return (
        <Link
          aria-label="Open trips"
          className={`${linkBaseClass} ${linkInactiveClass} ${layoutClass}`}
          href="/dashboard"
        >
          <MapPin className="h-5 w-5" />
          {layout === "desktop" ? <span>Trips</span> : <span className="sr-only">Open trips</span>}
        </Link>
      );
    }

    if (!currentTripId) {
      if (layout === "mobile") {
        return (
          <div
            className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-center ${layoutClass}`}
            role="status"
          >
            <span className="sr-only">
              You have no upcoming trips. Want a new adventure? Use the New adventure link to create a trip.
            </span>
            <p className="line-clamp-2 text-[9px] font-medium leading-tight text-[var(--muted)]" aria-hidden>
              No upcoming trips
            </p>
            <Link
              href="/trips/new"
              className="text-[10px] font-semibold leading-none text-[var(--accent)] underline-offset-2 hover:underline"
            >
              New adventure
            </Link>
          </div>
        );
      }

      return (
        <div
          className="flex max-w-xl min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 sm:gap-3"
          role="status"
        >
          <p className="min-w-0 text-sm leading-snug text-[var(--muted)]">
            You have no upcoming trips. Want a new adventure?
          </p>
          <Link href="/trips/new" className={newTripButtonClass}>
            Create a trip
          </Link>
        </div>
      );
    }

    return (
      <Link
        aria-label="Current trip"
        className={`${linkBaseClass} ${currentTripActive ? linkActiveClass : linkInactiveClass} ${layoutClass}`}
        href={currentTripHref}
      >
        <MapPin className="h-5 w-5" />
        {layout === "desktop" ? <span>Current trip</span> : <span className="sr-only">Current trip</span>}
      </Link>
    );
  };

  const renderNotificationsLink = (layout: "desktop" | "mobile") =>
    renderSideLink(RIGHT_NAV_ITEM, layout);

  const profileLink = (layout: "desktop" | "mobile") => (
    <Link
      aria-label={profileLabel}
      className={`${linkBaseClass} ${
        profileIsActive ? "bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] text-[var(--foreground)]" : linkInactiveClass
      } ${layout === "mobile" ? "w-full min-w-0" : ""}`}
      href={profileHref}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] text-xs font-semibold text-[#fafafa]">
        {profile?.avatar_url ? (
          <Image
            alt={profileLabel}
            className="object-cover"
            fill
            sizes="36px"
            src={profile.avatar_url}
          />
        ) : (
          <span>{profileInitials || "Y"}</span>
        )}
      </span>
      {layout === "desktop" ? <span>{profileLabel}</span> : <span className="sr-only">{profileLabel}</span>}
    </Link>
  );

  return (
    <div className={containerClassName} style={mobile ? (tripNavTheme ?? undefined) : undefined}>
      <div className={cardClassName}>
        {mobile ? (
          <nav
            aria-label="Primary"
            className="grid w-full grid-cols-5 gap-1 [&>a]:min-h-11 [&>a]:justify-center [&>span]:min-h-11 [&>span]:justify-center"
          >
            {leftItems.map((item) => renderSideLink(item, "mobile"))}
            {renderCurrentTripControl("mobile")}
            {renderNotificationsLink("mobile")}
            {profileLink("mobile")}
          </nav>
        ) : (
          <nav
            aria-label="Primary"
            className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface-elevated)]/95 px-4 py-2 backdrop-blur-md sm:px-6 lg:px-8"
            style={tripNavTheme ?? undefined}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {leftItems.map((item) => renderSideLink(item, "desktop"))}
              {renderCurrentTripControl("desktop")}
              {renderNotificationsLink("desktop")}
            </div>
            <div className="flex shrink-0 items-center gap-2">{profileLink("desktop")}</div>
          </nav>
        )}
      </div>
    </div>
  );
}
