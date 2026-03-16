import { redirect } from "next/navigation";
import DashboardTripList from "@/components/dashboard/DashboardTripList";
import PageBackground from "@/components/ui/PageBackground";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip, TripParticipant } from "@/lib/types";

type DashboardTrip = Pick<
  Trip,
  "end_date" | "id" | "image_url" | "location_name" | "name" | "start_date"
> & {
  participants: Array<{
    avatarUrl: string | null;
    displayName: string | null;
    userId: string;
  }>;
};

type MembershipRow = Pick<TripParticipant, "trip_id">;
type DashboardTripRow = Pick<
  Trip,
  "end_date" | "id" | "image_url" | "location_name" | "name" | "start_date"
>;
type ParticipantRow = Pick<TripParticipant, "role" | "trip_id" | "user_id">;
type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;

function compareParticipants(
  left: Pick<TripParticipant, "role" | "user_id"> & { display_name: string | null },
  right: Pick<TripParticipant, "role" | "user_id"> & { display_name: string | null },
): number {
  const roleRank = {
    organizer: 0,
    planner: 1,
    member: 2,
  } as const;

  const roleDifference = roleRank[left.role] - roleRank[right.role];

  if (roleDifference !== 0) {
    return roleDifference;
  }

  return (left.display_name || left.user_id).localeCompare(right.display_name || right.user_id);
}

async function getDashboardTrips(userId: string): Promise<DashboardTrip[]> {
  const supabase = await createClient();

  const { data: membershipData, error: membershipError } = await supabase
    .from("trip_participants")
    .select("trip_id")
    .eq("user_id", userId);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipRows = (membershipData ?? []) as MembershipRow[];
  const tripIds = [...new Set(membershipRows.map((row) => row.trip_id))];

  if (tripIds.length === 0) {
    return [];
  }

  const [{ data: tripsData, error: tripsError }, { data: participantsData, error: participantsError }] =
    await Promise.all([
      supabase
        .from("trips")
        .select("id, name, image_url, location_name, start_date, end_date")
        .in("id", tripIds),
      supabase.from("trip_participants").select("trip_id, user_id, role").in("trip_id", tripIds),
    ]);

  if (tripsError) {
    throw new Error(tripsError.message);
  }

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const trips = (tripsData ?? []) as DashboardTripRow[];
  const participantRows = (participantsData ?? []) as ParticipantRow[];
  const participantUserIds = [...new Set(participantRows.map((row) => row.user_id))];

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", participantUserIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = (profilesData ?? []) as ProfileRow[];
  const profileMap = new Map<string, ProfileRow>();
  for (const profile of profiles) {
    profileMap.set(profile.id, profile);
  }

  const participantsByTrip = new Map<
    string,
    Array<Pick<TripParticipant, "role" | "user_id"> & { display_name: string | null; avatar_url: string | null }>
  >();

  for (const participant of participantRows) {
    const existingParticipants = participantsByTrip.get(participant.trip_id) ?? [];
    const profile = profileMap.get(participant.user_id);

    existingParticipants.push({
      avatar_url: profile?.avatar_url ?? null,
      display_name: profile?.display_name ?? null,
      role: participant.role,
      user_id: participant.user_id,
    });

    participantsByTrip.set(participant.trip_id, existingParticipants);
  }

  return trips
    .slice()
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .map((trip) => ({
      ...trip,
      participants: (participantsByTrip.get(trip.id) ?? [])
        .slice()
        .sort(compareParticipants)
        .map((participant) => ({
          avatarUrl: participant.avatar_url,
          displayName: participant.display_name,
          userId: participant.user_id,
        })),
    }));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const trips = await getDashboardTrips(user.id);

  return (
    <main className="page-bg relative min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-7xl">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-[0_4px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-7 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--accent-gradient)] opacity-20 rounded-t-2xl" />

          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-wide uppercase gradient-text">
              Dashboard
            </p>
            <h1 className="font-display text-5xl leading-[0.95] text-[#fafafa] sm:text-6xl">
              Your trips live here
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              Jump back into the plans already in motion or spin up a fresh trip and head straight
              to invite links for your crew.
            </p>
          </div>

          <DashboardTripList currentUserId={user.id} trips={trips} />
        </section>
      </div>
    </main>
  );
}
