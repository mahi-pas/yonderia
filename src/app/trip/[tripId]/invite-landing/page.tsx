import Image from "next/image";
import Link from "next/link";
import { avatarImageReferrerPolicy, isGoogleUserContentAvatarUrl } from "@/lib/avatar-image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthButtons from "@/components/auth/AuthButtons";
import PageBackground from "@/components/ui/PageBackground";
import { getInvitePreview } from "@/lib/trips";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/utils";

type PageProps = {
  params: Promise<{
    tripId: string;
  }>;
  searchParams: Promise<{
    code?: string | string[];
  }>;
};

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
  const fallbackTitle = "You're Invited to a Trip | Join & Plan Adventures | Yonderia";
  const fallbackDescription =
    "You've been invited to a trip on Yonderia. Sign in to view the itinerary, dates, and location. Plan adventures with your people.";

  if (!code) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        type: "website",
        url: `${baseUrl}/trip/${tripId}/invite-landing`,
        images: [{ url: defaultImageUrl, alt: "Yonderia – Plan adventures with your people" }],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: [defaultImageUrl],
      },
    };
  }

  const preview = await getInvitePreview(createAdminClient(), code);

  if (!preview || preview.tripId !== tripId) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      openGraph: {
        title: fallbackTitle,
        description: fallbackDescription,
        type: "website",
        url: `${baseUrl}/trip/${tripId}/invite-landing`,
        images: [{ url: defaultImageUrl, alt: "Yonderia – Plan adventures with your people" }],
      },
      twitter: {
        card: "summary_large_image",
        title: fallbackTitle,
        description: fallbackDescription,
        images: [defaultImageUrl],
      },
    };
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
      url: `${baseUrl}/trip/${tripId}/invite-landing?code=${encodeURIComponent(code)}`,
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

function normalizeCodeParam(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = Array.isArray(value) ? value[0] ?? null : value;
  const trimmedValue = normalizedValue?.trim();

  return trimmedValue ? trimmedValue : null;
}

function formatInviteDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return `${formatShortDate(startDate).replace(/, \d{4}$/u, "")} - ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }

  if (sameYear) {
    return `${formatShortDate(startDate).replace(/, \d{4}$/u, "")} - ${formatShortDate(endDate)}`;
  }

  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function buildPostAuthPath(tripId: string, code: string, codeType: "join" | "join_planner" | "view"): string {
  if (codeType === "view") {
    return `/trip/${tripId}?code=${encodeURIComponent(code)}`;
  }

  return `/trip/${tripId}/join?code=${encodeURIComponent(code)}`;
}

function OrganizerAvatar({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string | null;
}) {
  const fallbackLabel = (displayName?.trim()?.charAt(0) || "H").toUpperCase();

  return (
    <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-[#121212] bg-[#D02020]/15 shadow-[2px_2px_0px_0px_black]">
      {avatarUrl ? (
        <Image
          alt={`${displayName || "Host"} avatar`}
          className="object-cover"
          fill
          referrerPolicy={avatarImageReferrerPolicy}
          sizes="48px"
          src={avatarUrl}
          unoptimized={isGoogleUserContentAvatarUrl(avatarUrl)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#D02020]/15 text-base font-bold text-[#D02020]">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

function InvalidInviteState() {
  return (
    <main className="page-bg relative min-h-screen overflow-hidden bg-[#F0F0F0] px-4 py-8 sm:px-6 sm:py-10">
      <PageBackground />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <section className="w-full border-4 border-[#121212] bg-white p-7 text-center shadow-[8px_8px_0px_0px_black] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Invite link</p>
          <h1 className="mt-4 text-4xl uppercase tracking-tighter font-black leading-[0.9] text-[#121212]">
            This invite link is no longer valid
          </h1>
          <p className="mt-4 text-sm font-bold leading-6 text-[#888888]">
            It may have expired or been turned off by the organizer. You can ask them for a fresh link.
          </p>
          <Link
            className="mt-7 inline-flex min-h-12 items-center justify-center bg-[#D02020] px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_black] transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            href="/"
          >
            Back to home
          </Link>
        </section>
      </div>
    </main>
  );
}

export default async function TripInviteLandingPage({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const resolvedSearchParams = await searchParams;
  const code = normalizeCodeParam(resolvedSearchParams.code);

  if (!code) {
    return <InvalidInviteState />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const preview = await getInvitePreview(createAdminClient(), code);

  if (!preview || preview.tripId !== tripId) {
    return <InvalidInviteState />;
  }

  const redirectPath = buildPostAuthPath(tripId, code, preview.codeType);

  if (user) {
    redirect(redirectPath);
  }

  const isViewInvite = preview.codeType === "view";
  const headline = isViewInvite ? "You've been shared a trip!" : "You're invited!";
  const buttonLabel = isViewInvite ? "Sign in with Google to view" : "Sign in with Google to join";
  const subtitle = isViewInvite
    ? "Sign in to explore the full itinerary and map."
    : "You'll be able to see the full itinerary, RSVP to events, and coordinate with the group.";
  const organizerName = preview.organizer.displayName?.trim() || "your organizer";

  return (
    <main className="page-bg relative min-h-screen overflow-hidden bg-[#F0F0F0] px-3 py-3 sm:px-5 sm:py-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-8 top-16 h-40 w-40 border-4 border-[#D02020]/20"
        />
        <div
          className="absolute right-4 top-6 h-48 w-48 border-4 border-[#1040C0]/15"
        />
        <div
          className="absolute bottom-10 left-1/4 h-44 w-44 border-4 border-[#F0C020]/20"
        />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden border-4 border-[#121212] bg-white shadow-[8px_8px_0px_0px_black] sm:min-h-[calc(100vh-2.5rem)]">
        <div className="absolute inset-0">
          {preview.trip.image_url ? (
            <Image
              alt={`${preview.trip.name} invite image`}
              className="object-cover"
              fill
              priority
              sizes="100vw"
              src={preview.trip.image_url}
            />
          ) : (
            <div className="h-full w-full bg-[#F0F0F0]" />
          )}
          <div className="absolute inset-0 bg-white/60" />
        </div>

        <div className="relative flex w-full flex-col justify-end p-5 sm:p-8 lg:p-10">
          <div className="max-w-2xl border-4 border-[#121212] bg-white p-5 shadow-[8px_8px_0px_0px_black] sm:p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Yonderia invite</p>
            <h1 className="mt-4 text-[clamp(2.9rem,12vw,5.2rem)] uppercase tracking-tighter font-black leading-[0.9] text-[#121212]">
              {headline}
            </h1>
            <h2 className="mt-4 text-[clamp(2rem,8vw,3.5rem)] font-black uppercase tracking-tighter leading-[0.9] text-balance text-[#121212]">
              {preview.trip.name}
            </h2>

            <div className="mt-6 flex min-w-0 flex-wrap gap-3 text-sm font-bold text-[#888888]">
              <div className="min-w-0 max-w-full break-words border-2 border-[#121212] bg-[#D02020]/10 px-4 py-2">
                {formatInviteDateRange(preview.trip.start_date, preview.trip.end_date)}
              </div>
              <div className="min-w-0 max-w-full break-words border-2 border-[#121212] bg-[#1040C0]/10 px-4 py-2">
                {preview.trip.location_name || "Location coming together"}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <OrganizerAvatar
                avatarUrl={preview.organizer.avatarUrl}
                displayName={preview.organizer.displayName}
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#888888]">Hosted by</p>
                <p className="text-base font-bold text-[#121212]">{organizerName}</p>
              </div>
            </div>

            <div className="mt-8 max-w-xl">
              <AuthButtons
                buttonClassName="min-h-14 bg-[#D02020] px-6 py-4 text-lg font-bold text-white shadow-[4px_4px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:ring-[#D02020]/20"
                buttonLabel={buttonLabel}
                containerClassName="max-w-none"
                redirectTo={redirectPath}
              />
              <p className="mt-4 text-sm font-bold leading-6 text-[#888888]">{subtitle}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
