import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import BackgroundEffects from "@/components/trip/BackgroundEffects";
import DayItinerary from "@/components/trip/DayItinerary";
import LiveTripOverview from "@/components/trip/LiveTripOverview";
import ParticipantsRow from "@/components/trip/ParticipantsRow";
import TripMap from "@/components/trip/TripMap";
import TripHeader from "@/components/trip/TripHeader";
import TripThemeProvider from "@/components/trip/TripThemeProvider";
import Input from "@/components/ui/Input";
import PageBackground from "@/components/ui/PageBackground";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getInviteCodeLookup,
  getInvitePreview,
  getParticipantMembership,
  getTripPageData,
  type ParticipantMembership,
  type TripPageData,
} from "@/lib/trips";
import { getSiteUrl } from "@/lib/site-url";

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

function buildLinkPreviewDescription(
  startDate: string,
  endDate: string,
  locationName: string | null,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const location = locationName?.trim() || "Location TBD";
  return `${dateStr} · ${location}`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { tripId } = await params;
  const resolved = await searchParams;
  const code = normalizeCodeParam(resolved.code);

  if (!code) {
    return {
      title: "Trip | Yonderia",
      description: "Plan adventures with your people.",
    };
  }

  const preview = await getInvitePreview(createAdminClient(), code);

  if (!preview || preview.tripId !== tripId) {
    return {
      title: "Trip | Yonderia",
      description: "Plan adventures with your people.",
    };
  }

  const title = preview.trip.name;
  const description = buildLinkPreviewDescription(
    preview.trip.start_date,
    preview.trip.end_date,
    preview.trip.location_name,
  );
  const baseUrl = await getSiteUrl();
  const imageUrl = preview.trip.image_url?.startsWith("http")
    ? preview.trip.image_url
    : preview.trip.image_url
      ? `${baseUrl}${preview.trip.image_url.startsWith("/") ? "" : "/"}${preview.trip.image_url}`
      : undefined;

  return {
    title: `${title} | Yonderia`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${baseUrl}/trip/${tripId}?code=${encodeURIComponent(code)}`,
      ...(imageUrl && {
        images: [{ url: imageUrl, alt: `${preview.trip.name} trip header` }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
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
    <div className="trip-card rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm">
      <p className="text-sm leading-6 text-[#d4d4d8]">
        You&apos;re viewing this trip as a guest. Have an invite code?{" "}
        <Link className="font-semibold text-[#8b5cf6] underline underline-offset-4 hover:text-[#a78bfa]" href={`/trip/${tripId}/join`}>
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
    <main className="page-bg relative min-h-screen px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-10">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm sm:p-8">
        <p className="text-xs font-semibold tracking-wide uppercase gradient-text">Trip access</p>
        <h1 className="mt-3 font-display text-4xl leading-none text-[#fafafa]">Enter your invite code</h1>
        <p className="mt-3 text-sm leading-6 text-[#d4d4d8]">
          This trip is private. Drop in a join code to continue.
        </p>

        <form action={`/trip/${tripId}/join`} className="mt-6 space-y-4" method="get">
          <Input label="Invite code" name="code" placeholder="abc123join" />
          {errorMessage ? (
            <div className="rounded-2xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
              {errorMessage}
            </div>
          ) : null}
          <div className="sticky bottom-3 z-10 -mx-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_20px_rgba(139,92,246,0.3)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/30"
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
  const theme = data.trip.theme ?? undefined;
  const effect = theme?.effect ?? "none";

  return (
    <TripThemeProvider theme={theme}>
      <main className="page-bg relative min-h-screen px-4 py-5 sm:px-6 sm:py-7 lg:px-10">
        <PageBackground />
        <BackgroundEffects effect={effect} />
        <div className="relative z-10 mx-auto max-w-6xl space-y-5 lg:space-y-6">
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

        <section className="trip-card rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-wide uppercase gradient-text">About this trip</p>
          <div className="mt-4 text-sm leading-7 text-[#d4d4d8] sm:text-base">
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
    </TripThemeProvider>
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
        currentUserId: user.id,
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
      if (user) {
        redirect(`/trip/${tripId}/join?code=${encodeURIComponent(code)}`);
      }

      redirect(`/trip/${tripId}/invite-landing?code=${encodeURIComponent(code)}`);
    }

    return <InviteEntryForm errorMessage="That invite code is invalid or no longer active." tripId={tripId} />;
  }

  return <InviteEntryForm tripId={tripId} />;
}
