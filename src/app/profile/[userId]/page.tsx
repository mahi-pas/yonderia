import Image from "next/image";
import Link from "next/link";
import { avatarImageReferrerPolicy, isGoogleUserContentAvatarUrl } from "@/lib/avatar-image";
import { notFound } from "next/navigation";
import EditProfileButton from "@/components/profile/EditProfileButton";
import SignOutButton from "@/components/profile/SignOutButton";
import TripCard from "@/components/trip/TripCard";
import PageBackground from "@/components/ui/PageBackground";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sanitizeProfileReturnPath } from "@/lib/trip-navigation";
import type { Profile, Trip, TripParticipant } from "@/lib/types";

type PageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
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

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { userId } = await params;
  const resolvedSearch = await searchParams;
  const returnToTrip = sanitizeProfileReturnPath(resolvedSearch.from);
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
    <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl space-y-6">
        <header>
          <div className="flex items-start gap-4">
            {returnToTrip ? (
              <Link
                aria-label="Back to trip"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-2 border-[#121212] bg-white text-xl font-bold text-[#121212] shadow-[3px_3px_0px_0px_black] transition hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                href={returnToTrip}
              >
                ←
              </Link>
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Profile</p>
              <h1 className="mt-2 text-balance font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-5xl">
                {displayName}
              </h1>
            </div>
          </div>
        </header>

        <section className="border-2 sm:border-4 border-[#121212] bg-white py-8 text-center shadow-[6px_6px_0px_0px_black] sm:shadow-[8px_8px_0px_0px_black] sm:py-10">
          <div className="mx-auto flex max-w-xl flex-col items-center px-5 sm:px-8">
            <div className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-4 border-[#121212] bg-[#F0C020] text-3xl font-black text-[#121212] sm:h-[160px] sm:w-[160px] sm:text-5xl">
              {profile.avatar_url ? (
                <Image
                  alt={displayName}
                  className="object-cover"
                  fill
                  referrerPolicy={avatarImageReferrerPolicy}
                  sizes="(max-width: 639px) 120px, 160px"
                  src={profile.avatar_url}
                  unoptimized={isGoogleUserContentAvatarUrl(profile.avatar_url)}
                />
              ) : (
                <span>{getInitials(displayName) || "Y"}</span>
              )}
            </div>

            <h2 className="mt-5 font-display text-3xl font-black uppercase tracking-tighter leading-[0.9] text-[#121212] sm:text-4xl">
              {displayName}
            </h2>

            <div className="mt-4 inline-flex min-h-11 items-center gap-2 border-2 border-[#121212] bg-white px-4 py-2 text-sm font-bold text-[#121212] shadow-[3px_3px_0px_0px_black]">
              <span className="h-3 w-3 bg-[#1040C0]" />
              <span>
                {resolvedTripCount} {resolvedTripCount === 1 ? "trip" : "trips"}
              </span>
            </div>

            {isOwnProfile ? (
              <div className="mt-5 flex flex-col items-center gap-3">
                <EditProfileButton
                  initialAvatarUrl={profile.avatar_url}
                  initialDisplayName={profile.display_name}
                  userId={profile.id}
                />
                <SignOutButton />
              </div>
            ) : null}
          </div>
        </section>

        {viewer && sharedTrips.length > 0 ? (
          <section>
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Shared trips</p>
              <h2 className="font-display text-3xl font-black uppercase tracking-tighter leading-[0.9] text-[#121212]">Trips you share</h2>
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
