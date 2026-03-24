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
import ViewOnlyPromoOverlay from "@/components/trip/ViewOnlyPromoOverlay";
import Input from "@/components/ui/Input";
import PageBackground from "@/components/ui/PageBackground";
import LoginButton from "@/components/auth/LoginButton";
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

const DEFAULT_OG_IMAGE_PATH = "/yonderia_logo.jpg";

function buildLinkPreviewDescription(
  startDate: string,
  endDate: string,
  locationName: string | null,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dateStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const location = locationName?.trim() || "Location TBD";
  return `${dateStr} · ${location} · Plan and share trips on Yonderia.`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { tripId } = await params;
  const resolved = await searchParams;
  const code = normalizeCodeParam(resolved.code);

  const baseUrl = await getSiteUrl();
  const defaultImageUrl = `${baseUrl}${DEFAULT_OG_IMAGE_PATH}`;

  const fallbackTitle = "Trip Details | Plan & Share Adventures with Friends | Yonderia";
  const fallbackDescription =
    "View trip details, dates, and locations. Plan adventures with your people and share itineraries on Yonderia.";
  const fallbackMeta = {
    title: fallbackTitle,
    description: fallbackDescription,
    openGraph: {
      title: fallbackTitle,
      description: fallbackDescription,
      type: "website" as const,
      url: `${baseUrl}/trip/${tripId}`,
      images: [{ url: defaultImageUrl, alt: "Yonderia – Plan adventures with your people" }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: fallbackTitle,
      description: fallbackDescription,
      images: [defaultImageUrl],
    },
  };

  if (!code) {
    return fallbackMeta;
  }

  const preview = await getInvitePreview(createAdminClient(), code);

  if (!preview || preview.tripId !== tripId) {
    return fallbackMeta;
  }

  const title = preview.trip.name;
  const description = buildLinkPreviewDescription(
    preview.trip.start_date,
    preview.trip.end_date,
    preview.trip.location_name,
  );
  const imageUrl = preview.trip.image_url?.startsWith("http")
    ? preview.trip.image_url
    : preview.trip.image_url
      ? `${baseUrl}${preview.trip.image_url.startsWith("/") ? "" : "/"}${preview.trip.image_url}`
      : defaultImageUrl;

  return {
    title: `${title} | Yonderia`,
    description,
    openGraph: {
      title: `${title} | Yonderia`,
      description,
      type: "website",
      url: `${baseUrl}/trip/${tripId}?code=${encodeURIComponent(code)}`,
      images: [{ url: imageUrl, alt: `${preview.trip.name} trip header` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Yonderia`,
      description,
      images: [imageUrl],
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
    <div className="border-2 border-[#121212] bg-[#F0C020] p-4 shadow-[3px_3px_0px_0px_black]">
      <p className="text-sm font-medium leading-6 text-[#121212]">
        You&apos;re viewing this trip as a guest. Have an invite code?{" "}
        <Link className="font-bold underline underline-offset-4 hover:text-[#D02020]" href={`/trip/${tripId}/join`}>
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
    <main className="page-bg relative min-h-screen px-4 py-12 pb-24 sm:px-6 sm:py-16 sm:pb-16">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-lg border-2 sm:border-4 border-[#121212] bg-white p-6 shadow-[6px_6px_0px_0px_black] sm:shadow-[8px_8px_0px_0px_black] sm:p-8">
        <div className="mb-3 h-2 w-2 bg-[#D02020]" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Trip access</p>
        <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-4xl">Enter your invite code</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#888888]">
          This trip is private. Drop in a join code to continue.
        </p>

        <form action={`/trip/${tripId}/join`} className="mt-6 space-y-4" method="get">
          <Input label="Invite code" name="code" placeholder="abc123join" />
          {errorMessage ? (
            <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-medium text-[#D02020]">
              {errorMessage}
            </div>
          ) : null}
          <div className="sticky bottom-3 z-10 -mx-1 p-3 sm:static sm:mx-0 sm:p-0">
            <button
              className="inline-flex min-h-11 w-full items-center justify-center border-2 border-[#121212] bg-[#D02020] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_black] transition duration-200 hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-[#D02020]/40"
              type="submit"
            >
              Continue to join
            </button>
          </div>
        </form>

        <div className="mt-8 border-t-2 border-[#121212] pt-6">
          <p className="text-center text-sm font-medium text-[#888888]">Already in the trip? Sign in</p>
          <div className="mt-4 flex justify-center">
            <LoginButton
              buttonLabel="Sign in with Google"
              redirectTo={`/trip/${tripId}`}
            />
          </div>
        </div>
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
      {guestMode ? <ViewOnlyPromoOverlay /> : null}
      <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <PageBackground />
        <BackgroundEffects effect={effect} />
        <div className="relative z-10 mx-auto max-w-6xl space-y-5 sm:space-y-6 lg:space-y-8">
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

        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground)]">About this trip</p>
          <div className="text-sm font-medium leading-7 text-[#888888] sm:text-base">
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
