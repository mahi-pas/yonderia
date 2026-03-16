import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditProfileButton from "@/components/profile/EditProfileButton";
import TripCard from "@/components/trip/TripCard";
import PageBackground from "@/components/ui/PageBackground";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip, TripParticipant } from "@/lib/types";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
};

type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;
type MembershipRow = Pick<TripParticipant, "trip_id" | "user_id">;
type ParticipantRow = Pick<TripParticipant, "role" | "trip_id" | "user_id">;
type TripRow = Pick<Trip, "end_date" | "id" | "image_url" | "location_name" | "name" | "start_date">;

type SharedTripCard = TripRow & {
  participants: Array<{
    avatarUrl: string | null;
    displayName: string | null;
    userId: string;
  }>;
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

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

async function getSharedTrips(tripIds: string[]): Promise<SharedTripCard[]> {
  if (tripIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
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

  const trips = (tripsData ?? []) as TripRow[];
  const participantRows = (participantsData ?? []) as ParticipantRow[];
  const participantUserIds = [...new Set(participantRows.map((row) => row.user_id))];

  const { data: profilesData, error: profilesError } =
    participantUserIds.length === 0
      ? { data: [] as ProfileRow[], error: null }
      : await supabase.from("profiles").select("id, display_name, avatar_url").in("id", participantUserIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profilesData ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const participantsByTrip = new Map<
    string,
    Array<Pick<TripParticipant, "role" | "user_id"> & { avatar_url: string | null; display_name: string | null }>
  >();

  for (const participant of participantRows) {
    const profile = profileMap.get(participant.user_id);
    const existingParticipants = participantsByTrip.get(participant.trip_id) ?? [];

    existingParticipants.push({
      avatar_url: profile?.avatar_url ?? null,
      display_name: profile?.display_name ?? null,
      role: participant.role,
      user_id: participant.user_id,
    });

    participantsByTrip.set(participant.trip_id, existingParticipants);
  }

  const tripOrder = new Map(tripIds.map((tripId, index) => [tripId, index]));

  return trips
    .slice()
    .sort((left, right) => (tripOrder.get(left.id) ?? 0) - (tripOrder.get(right.id) ?? 0))
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

export default async function ProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const [
    {
      data: { user: viewer },
    },
    { data: profileData, error: profileError },
    { count: tripCount, error: tripCountError },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("id, display_name, avatar_url").eq("id", userId).maybeSingle(),
    adminSupabase.from("trip_participants").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (tripCountError) {
    throw new Error(tripCountError.message);
  }

  const profile = profileData as ProfileRow | null;

  if (!profile) {
    notFound();
  }

  const isOwnProfile = viewer?.id === profile.id;
  let sharedTrips: SharedTripCard[] = [];

  if (viewer && viewer.id !== profile.id) {
    const [{ data: viewerMemberships, error: viewerMembershipError }, { data: ownerMemberships, error: ownerMembershipError }] =
      await Promise.all([
        supabase.from("trip_participants").select("trip_id, user_id").eq("user_id", viewer.id),
        supabase.from("trip_participants").select("trip_id, user_id").eq("user_id", profile.id),
      ]);

    if (viewerMembershipError) {
      throw new Error(viewerMembershipError.message);
    }

    if (ownerMembershipError) {
      throw new Error(ownerMembershipError.message);
    }

    const viewerTripIds = new Set(
      ((viewerMemberships ?? []) as MembershipRow[]).map((membership) => membership.trip_id),
    );
    const sharedTripIds = ((ownerMemberships ?? []) as MembershipRow[])
      .map((membership) => membership.trip_id)
      .filter((tripId) => viewerTripIds.has(tripId));

    sharedTrips = await getSharedTrips(sharedTripIds);
  }

  const displayName = profile.display_name?.trim() || "Traveler";
  const resolvedTripCount = tripCount ?? 0;

  return (
    <main className="page-bg relative min-h-screen px-4 py-5 sm:px-6 sm:py-7 lg:px-10">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl space-y-5">
        <header className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Link
              aria-label={viewer ? "Back to dashboard" : "Back to home"}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-xl text-[var(--muted)] transition hover:bg-[var(--surface-elevated)]"
              href={viewer ? "/dashboard" : "/"}
            >
              ←
            </Link>

            <div className="min-w-0 flex-1">
              <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Profile</p>
              <h1 className="mt-2 text-balance font-display text-4xl leading-none text-[#fafafa] sm:text-5xl">
                {displayName}
              </h1>
            </div>
          </div>
        </header>

        <section className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto flex max-w-xl flex-col items-center">
            <div className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-4 border-[var(--surface)] bg-[var(--surface-elevated)] text-3xl font-semibold text-[#8b5cf6] ring-2 ring-[#8b5cf6]/20 sm:h-[160px] sm:w-[160px] sm:text-5xl">
              {profile.avatar_url ? (
                <Image
                  alt={displayName}
                  className="object-cover"
                  fill
                  sizes="(max-width: 639px) 120px, 160px"
                  src={profile.avatar_url}
                />
              ) : (
                <span>{getInitials(displayName) || "Y"}</span>
              )}
            </div>

            <h2 className="mt-5 font-display text-4xl leading-none text-[#fafafa] sm:text-5xl">
              {displayName}
            </h2>

            <div className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[#d4d4d8]">
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-[#8b5cf6]"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 7V6a5 5 0 0 1 10 0v1m-9 0h8m-9 0A2 2 0 0 0 5 9v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2m-9 0h10"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>
                {resolvedTripCount} {resolvedTripCount === 1 ? "trip" : "trips"}
              </span>
            </div>

            {isOwnProfile ? (
              <div className="mt-5">
                <EditProfileButton
                  initialAvatarUrl={profile.avatar_url}
                  initialDisplayName={profile.display_name}
                  userId={profile.id}
                />
              </div>
            ) : null}
          </div>
        </section>

        {viewer && sharedTrips.length > 0 ? (
          <section className="p-5 sm:p-6">
            <div className="space-y-2 text-center sm:text-left">
              <p className="gradient-text text-xs font-semibold uppercase tracking-wide">Shared trips</p>
              <h2 className="font-display text-3xl leading-none text-[#fafafa]">Trips you share</h2>
            </div>

            <div className="mt-5 space-y-4">
              {sharedTrips.map((trip) => (
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
          </section>
        ) : null}
      </div>
    </main>
  );
}
