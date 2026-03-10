import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import InviteManagement from "@/components/trip/InviteManagement";
import ParticipantsView from "@/components/trip/ParticipantsView";
import { createClient } from "@/lib/supabase/server";
import type { InviteCodeType, Profile, TripParticipant } from "@/lib/types";
import { getParticipantMembership } from "@/lib/trips";

type PageProps = {
  params: Promise<{
    tripId: string;
  }>;
  searchParams: Promise<{
    tab?: string | string[];
  }>;
};

type ParticipantListRow = Pick<
  TripParticipant,
  | "arrival_location"
  | "arrival_time"
  | "departure_location"
  | "departure_time"
  | "id"
  | "nickname"
  | "role"
  | "trip_id"
  | "user_id"
>;

type ProfileRow = Pick<Profile, "avatar_url" | "display_name" | "id">;

type ParticipantViewModel = {
  arrivalLocation: string | null;
  arrivalTime: string | null;
  avatarUrl: string | null;
  departureLocation: string | null;
  departureTime: string | null;
  displayName: string | null;
  nickname: string;
  participantId: string;
  role: TripParticipant["role"];
  userId: string;
};

type InviteViewModel = {
  code: string;
  codeType: InviteCodeType;
  createdAt: string;
  createdBy: string | null;
  creatorName: string;
  id: string;
  isActive: boolean;
};

const ROLE_RANK = {
  organizer: 0,
  planner: 1,
  member: 2,
} as const;

function normalizeTab(value: string | string[] | undefined): "invites" | "people" {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  return normalizedValue === "invites" ? "invites" : "people";
}

function getDisplayLabel(
  participant: Pick<TripParticipant, "nickname" | "user_id"> & { displayName: string | null },
): string {
  const nickname = participant.nickname?.trim();
  const displayName = participant.displayName?.trim();
  return nickname || displayName || participant.user_id;
}

function compareParticipants(left: ParticipantViewModel, right: ParticipantViewModel): number {
  const roleDifference = ROLE_RANK[left.role] - ROLE_RANK[right.role];

  if (roleDifference !== 0) {
    return roleDifference;
  }

  return getDisplayLabel({
    displayName: left.displayName,
    nickname: left.nickname,
    user_id: left.userId,
  }).localeCompare(
    getDisplayLabel({
      displayName: right.displayName,
      nickname: right.nickname,
      user_id: right.userId,
    }),
  );
}

async function getSiteOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");

  if (!host) {
    throw new Error("Unable to determine request host.");
  }

  return `${protocol}://${host}`;
}

export default async function TripParticipantsPage({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedTab = normalizeTab(resolvedSearchParams.tab);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(`/trip/${tripId}/participants${requestedTab === "invites" ? "?tab=invites" : ""}`)}`);
  }

  const membership = await getParticipantMembership(supabase, tripId, user.id);

  if (!membership) {
    redirect(`/trip/${tripId}`);
  }

  const canManageInvites = membership.role === "organizer" || membership.role === "planner";
  const activeTab = requestedTab === "invites" && canManageInvites ? "invites" : "people";

  const [{ data: trip, error: tripError }, { data: participantRows, error: participantsError }, inviteResult] =
    await Promise.all([
      supabase.from("trips").select("id, name").eq("id", tripId).maybeSingle(),
      supabase
        .from("trip_participants")
        .select(
          "id, trip_id, user_id, nickname, role, arrival_time, arrival_location, departure_time, departure_location",
        )
        .eq("trip_id", tripId),
      canManageInvites
        ? supabase
            .from("invite_codes")
            .select("id, code, code_type, is_active, created_at, created_by")
            .eq("trip_id", tripId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (tripError) {
    throw new Error(tripError.message);
  }

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  if (inviteResult.error) {
    throw new Error(inviteResult.error.message);
  }

  if (!trip) {
    notFound();
  }

  const typedParticipantRows = (participantRows ?? []) as ParticipantListRow[];
  const inviteRows = (inviteResult.data ?? []) as Array<{
    code: string;
    code_type: InviteCodeType;
    created_at: string;
    created_by: string | null;
    id: string;
    is_active: boolean;
  }>;
  const profileIds = [...new Set([...typedParticipantRows.map((row) => row.user_id), ...inviteRows.map((row) => row.created_by).filter(Boolean)])];
  const { data: profileRows, error: profilesError } =
    profileIds.length === 0
      ? { data: [] as ProfileRow[], error: null }
      : await supabase.from("profiles").select("id, display_name, avatar_url").in("id", profileIds);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileMap = new Map<string, ProfileRow>();

  for (const profile of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(profile.id, profile);
  }

  const participants = typedParticipantRows
    .map((participant) => {
      const profile = profileMap.get(participant.user_id);
      return {
        arrivalLocation: participant.arrival_location,
        arrivalTime: participant.arrival_time,
        avatarUrl: profile?.avatar_url ?? null,
        departureLocation: participant.departure_location,
        departureTime: participant.departure_time,
        displayName: profile?.display_name ?? null,
        nickname: participant.nickname?.trim() || profile?.display_name?.trim() || "Traveler",
        participantId: participant.id,
        role: participant.role,
        userId: participant.user_id,
      } satisfies ParticipantViewModel;
    })
    .sort(compareParticipants);

  const invites = inviteRows.map((invite) => ({
    code: invite.code,
    codeType: invite.code_type,
    createdAt: invite.created_at,
    createdBy: invite.created_by,
    creatorName:
      (invite.created_by ? profileMap.get(invite.created_by)?.display_name : null)?.trim() || "Trip organizer",
    id: invite.id,
    isActive: invite.is_active,
  })) satisfies InviteViewModel[];

  const currentUserDisplayName = profileMap.get(user.id)?.display_name ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-5 sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-5 shadow-[0_24px_70px_rgba(104,45,20,0.12)] sm:p-6">
          <div className="flex items-start gap-4">
            <Link
              aria-label="Back to trip"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#ebc5b5] bg-white text-xl text-[#6b4131] shadow-sm transition hover:bg-[#fff3eb]"
              href={`/trip/${tripId}`}
            >
              ←
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Participants</p>
              <h1 className="mt-2 text-balance font-display text-4xl leading-none text-[#34180f] sm:text-5xl">
                {trip.name}
              </h1>
            </div>
          </div>

          <div className={`mt-5 grid gap-2 ${canManageInvites ? "grid-cols-2" : "grid-cols-1"}`}>
            <Link
              aria-current={activeTab === "people" ? "page" : undefined}
              className={[
                "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                activeTab === "people"
                  ? "bg-[#c76038] text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)]"
                  : "border border-[#e6b9a3] bg-white/80 text-[#6b4131] hover:bg-[#fff2ea]",
              ]
                .filter(Boolean)
                .join(" ")}
              href={`/trip/${tripId}/participants`}
            >
              People
            </Link>

            {canManageInvites ? (
              <Link
                aria-current={activeTab === "invites" ? "page" : undefined}
                className={[
                  "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                  activeTab === "invites"
                    ? "bg-[#c76038] text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)]"
                    : "border border-[#e6b9a3] bg-white/80 text-[#6b4131] hover:bg-[#fff2ea]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={`/trip/${tripId}/participants?tab=invites`}
              >
                Invites
              </Link>
            ) : null}
          </div>
        </header>

        {activeTab === "people" ? (
          <ParticipantsView
            currentUserId={user.id}
            currentUserRole={membership.role}
            participants={participants}
            tripId={tripId}
          />
        ) : (
          <InviteManagement
            currentUserDisplayName={currentUserDisplayName}
            currentUserId={user.id}
            currentUserRole={membership.role}
            invites={invites}
            siteOrigin={await getSiteOrigin()}
            tripId={tripId}
          />
        )}
      </div>
    </main>
  );
}
