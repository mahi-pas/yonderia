import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import DayItinerary from "@/components/trip/DayItinerary";
import LiveTripOverview from "@/components/trip/LiveTripOverview";
import ParticipantsRow from "@/components/trip/ParticipantsRow";
import TripMap from "@/components/trip/TripMap";
import TripHeader from "@/components/trip/TripHeader";
import Input from "@/components/ui/Input";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getInviteCodeLookup,
  getParticipantMembership,
  getTripPageData,
  type ParticipantMembership,
  type TripPageData,
} from "@/lib/trips";

type PageProps = {
  params: Promise<{
    tripId: string;
  }>;
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

function normalizeCodeParam(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");

  if (!host) {
    throw new Error("Unable to determine request host.");
  }

  return `${protocol}://${host}`;
}

async function fetchViewOnlyTripData(tripId: string, code: string): Promise<TripPageData | null> {
  const response = await fetch(
    `${await getBaseUrl()}/api/trip/${tripId}/view?code=${encodeURIComponent(code)}`,
    {
      cache: "no-store",
    },
  );

  if (response.status === 403) {
    return null;
  }

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error("Unable to load the shared trip.");
  }

  return (await response.json()) as TripPageData;
}

function GuestBanner({ tripId }: { tripId: string }) {
  return (
    <div className="rounded-[1.6rem] border border-[#f1c7b3] bg-[linear-gradient(180deg,#fff4ed,#ffefe5)] p-4 shadow-sm">
      <p className="text-sm leading-6 text-[#6b4131]">
        You&apos;re viewing this trip as a guest. Have an invite code?{" "}
        <Link className="font-semibold text-[#b24f2d] underline underline-offset-4" href={`/trip/${tripId}/join`}>
          Enter it to join!
        </Link>
      </p>
    </div>
  );
}

function InviteEntryForm({
  errorMessage,
  tripId,
}: {
  errorMessage?: string;
  tripId: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-10">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-6 shadow-[0_28px_90px_rgba(104,45,20,0.12)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Trip access</p>
        <h1 className="mt-3 font-display text-4xl leading-none text-[#34180f]">Enter your invite code</h1>
        <p className="mt-3 text-sm leading-6 text-[#6f4a3b]">
          This trip is private. Drop in a join code to continue.
        </p>

        <form action={`/trip/${tripId}/join`} className="mt-6 space-y-4" method="get">
          <Input label="Invite code" name="code" placeholder="abc123join" />
          {errorMessage ? (
            <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
              {errorMessage}
            </div>
          ) : null}
          <div className="sticky bottom-3 z-10 -mx-1 rounded-[1.5rem] border border-white/80 bg-[rgba(255,249,245,0.96)] p-3 shadow-[0_16px_35px_rgba(90,40,20,0.12)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#c76038] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)] transition hover:bg-[#b55531]"
              type="submit"
            >
              Continue to join
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function TripPageLayout({
  canEditTrip = false,
  canManageItinerary = false,
  currentParticipant = null,
  currentUserId,
  data,
  guestMode = false,
}: {
  canEditTrip?: boolean;
  canManageItinerary?: boolean;
  currentParticipant?: ParticipantMembership | null;
  currentUserId?: string;
  data: TripPageData;
  guestMode?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-5 sm:px-6 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-5 lg:space-y-6">
        {guestMode ? <GuestBanner tripId={data.trip.id} /> : null}

        <TripHeader
          canEdit={canEditTrip}
          endDate={data.trip.end_date}
          imageUrl={data.trip.image_url}
          locationName={data.trip.location_name}
          name={data.trip.name}
          startDate={data.trip.start_date}
          tripId={data.trip.id}
        />

        <section className="rounded-[1.75rem] border border-[#efd5c8] bg-white/75 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">About this trip</p>
          <div className="mt-4 text-sm leading-7 text-[#563a2e] sm:text-base">
            {data.trip.description?.trim() || "Trip details are still coming together."}
          </div>
        </section>

        {guestMode ? (
          <>
            <ParticipantsRow
              participants={data.participants}
              showProfileLinks={false}
              showSeeAll={false}
              tripId={data.trip.id}
            />
            <TripMap items={data.itineraryItems} tripEndDate={data.trip.end_date} tripStartDate={data.trip.start_date} />
            <DayItinerary
              canManage={false}
              items={data.itineraryItems}
              tripEndDate={data.trip.end_date}
              tripId={data.trip.id}
              tripStartDate={data.trip.start_date}
            />
          </>
        ) : (
          <LiveTripOverview
            canManageItinerary={canManageItinerary}
            currentParticipant={currentParticipant}
            currentUserId={currentUserId}
            initialItineraryItems={data.itineraryItems}
            initialParticipants={data.participants}
            tripEndDate={data.trip.end_date}
            tripId={data.trip.id}
            tripStartDate={data.trip.start_date}
          />
        )}
      </div>
    </main>
  );
}

export default async function TripPage({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const resolvedSearchParams = await searchParams;
  const code = normalizeCodeParam(resolvedSearchParams.code)?.trim() || null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const membership = await getParticipantMembership(supabase, tripId, user.id);

    if (membership) {
      const participantTripData = await getTripPageData(supabase, tripId, {
        includeProfilePaths: true,
      });

      if (!participantTripData) {
        notFound();
      }

      return (
        <TripPageLayout
          canEditTrip={membership.role === "organizer"}
          canManageItinerary={membership.role === "organizer" || membership.role === "planner"}
          currentParticipant={membership}
          currentUserId={user.id}
          data={participantTripData}
        />
      );
    }
  }

  if (code) {
    const adminSupabase = createAdminClient();
    const inviteCode = await getInviteCodeLookup(adminSupabase, tripId, code);

    if (inviteCode?.codeType === "view") {
      const viewOnlyTripData = await fetchViewOnlyTripData(tripId, code);

      if (viewOnlyTripData) {
        return <TripPageLayout data={viewOnlyTripData} guestMode />;
      }
    }

    if (inviteCode?.codeType === "join" || inviteCode?.codeType === "join_planner") {
      redirect(`/trip/${tripId}/join?code=${encodeURIComponent(code)}`);
    }

    return <InviteEntryForm errorMessage="That invite code is invalid or no longer active." tripId={tripId} />;
  }

  return <InviteEntryForm tripId={tripId} />;
}
