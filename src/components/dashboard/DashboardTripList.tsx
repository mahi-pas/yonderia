"use client";

import { useMemo, useState } from "react";
import CreateTripFlow from "@/components/trip/CreateTripFlow";
import TripCard from "@/components/trip/TripCard";

export type DashboardTrip = {
  end_date: string;
  id: string;
  image_url: string | null;
  location_name: string | null;
  name: string;
  start_date: string;
  participants: Array<{
    avatarUrl: string | null;
    displayName: string | null;
    userId: string;
  }>;
};

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitTripsByDate(trips: DashboardTrip[]) {
  const today = getTodayDateString();
  const upcoming: DashboardTrip[] = [];
  const past: DashboardTrip[] = [];

  for (const trip of trips) {
    if (trip.end_date >= today) {
      upcoming.push(trip);
    } else {
      past.push(trip);
    }
  }

  upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date));
  past.sort((a, b) => b.start_date.localeCompare(a.start_date));

  return { upcoming, past };
}

type Props = {
  trips: DashboardTrip[];
};

export default function DashboardTripList({ trips }: Props) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = useMemo(() => splitTripsByDate(trips), [trips]);

  return (
    <div className="mt-8">
      <div
        className="mb-6 w-fit flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/60 p-1"
        role="tablist"
        aria-label="Trip filter"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          aria-controls="upcoming-trips"
          id="tab-upcoming"
          onClick={() => setActiveTab("upcoming")}
          className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/50 ${
            activeTab === "upcoming"
              ? "bg-[var(--surface)] text-[#fafafa] shadow-sm"
              : "text-[var(--muted)] hover:text-[#e4e4e7]"
          }`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "past"}
          aria-controls="past-trips"
          id="tab-past"
          onClick={() => setActiveTab("past")}
          className={`min-w-[7rem] rounded-lg px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6]/50 ${
            activeTab === "past"
              ? "bg-[var(--surface)] text-[#fafafa] shadow-sm"
              : "text-[var(--muted)] hover:text-[#e4e4e7]"
          }`}
        >
          Past ({past.length})
        </button>
      </div>

      {activeTab === "upcoming" && (
        <div
          id="upcoming-trips"
          role="tabpanel"
          aria-labelledby="tab-upcoming"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <CreateTripFlow />
          {upcoming.map((trip) => (
            <TripCard
              key={trip.id}
              endDate={trip.end_date}
              id={trip.id}
              imageUrl={trip.image_url}
              locationName={trip.location_name}
              name={trip.name}
              participants={trip.participants}
              startDate={trip.start_date}
            />
          ))}
        </div>
      )}

      {activeTab === "past" && (
        <div
          id="past-trips"
          role="tabpanel"
          aria-labelledby="tab-past"
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {past.map((trip) => (
            <TripCard
              key={trip.id}
              endDate={trip.end_date}
              id={trip.id}
              imageUrl={trip.image_url}
              locationName={trip.location_name}
              name={trip.name}
              participants={trip.participants}
              startDate={trip.start_date}
            />
          ))}
        </div>
      )}

      {activeTab === "upcoming" && upcoming.length === 0 && (
        <div className="mt-6 px-5 py-4 text-sm leading-6 text-[var(--muted)]">
          No upcoming trips. Create one to get started.
        </div>
      )}

      {activeTab === "past" && past.length === 0 && (
        <div className="mt-6 px-5 py-4 text-sm leading-6 text-[var(--muted)]">
          No past trips yet.
        </div>
      )}
    </div>
  );
}
