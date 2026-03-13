import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginButton from "@/components/auth/LoginButton";
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
    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[#8b5cf6]/25 bg-[#8b5cf6]/15 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      {avatarUrl ? (
        <Image alt={`${displayName || "Host"} avatar`} className="object-cover" fill sizes="48px" src={avatarUrl} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(139,92,246,0.35),rgba(236,72,153,0.25))] text-base font-semibold text-[#8b5cf6]">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

function InvalidInviteState() {
  return (
    <main className="page-bg relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
      <PageBackground />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-7 text-center backdrop-blur-sm sm:p-9">
          <p className="gradient-text text-xs font-semibold tracking-wide uppercase">Invite link</p>
          <h1 className="mt-4 font-display text-4xl leading-none text-[#fafafa]">
            This invite link is no longer valid
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#d4d4d8]">
            It may have expired or been turned off by the organizer. You can ask them for a fresh link.
          </p>
          <Link
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
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
    <>
      <main className="page-bg relative min-h-screen overflow-hidden px-3 py-3 sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-12 top-20 h-52 w-52 rounded-full blur-[80px]"
            style={{ background: "rgba(124, 58, 237, 0.12)", animation: "inviteFloat 13s ease-in-out infinite" }}
          />
          <div
            className="absolute right-0 top-8 h-60 w-60 rounded-full blur-[100px]"
            style={{ background: "rgba(99, 102, 241, 0.1)", animation: "inviteFloat 17s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute bottom-6 left-1/4 h-56 w-56 rounded-full blur-[90px]"
            style={{ background: "rgba(124, 58, 237, 0.08)", animation: "inviteFloat 15s ease-in-out infinite" }}
          />
          {[...Array(16)].map((_, index) => (
            <span
              key={`streak-${index}`}
              className="absolute block w-px"
              style={{
                animation: `streak-fall ${8 + (index % 6) * 1.6}s linear infinite`,
                animationDelay: `${index * 0.5}s`,
                height: `${50 + (index % 4) * 30}px`,
                left: `${4 + index * 5.8}%`,
                background: `linear-gradient(180deg, transparent, rgba(139, 92, 246, ${0.18 + (index % 3) * 0.1}), transparent)`,
                boxShadow: `0 0 ${3 + (index % 3) * 2}px rgba(139, 92, 246, ${0.06 + (index % 3) * 0.04})`,
              }}
            />
          ))}
        </div>

        <section className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_40px_rgba(0,0,0,0.25)] sm:min-h-[calc(100vh-2.5rem)] sm:rounded-2xl">
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
              <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,var(--surface)_0%,rgba(24,24,27,0.24)_22%,transparent_38%),radial-gradient(circle_at_80%_15%,rgba(10,10,15,0.28),transparent_24%),linear-gradient(135deg,var(--border),var(--surface)_58%,var(--background)_100%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,15,0.2)_0%,rgba(10,10,15,0.34)_28%,rgba(10,10,15,0.7)_62%,rgba(10,10,15,0.92)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_28%)]" />
          </div>

          <div className="relative flex w-full flex-col justify-end p-5 sm:p-8 lg:p-10">
            <div className="max-w-2xl rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,20,31,0.5),rgba(10,10,15,0.7))] p-5 text-white shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-md sm:p-7">
              <p className="gradient-text text-xs font-semibold tracking-wide uppercase opacity-90">Yonderia invite</p>
              <h1 className="mt-4 font-display text-[clamp(2.9rem,12vw,5.2rem)] leading-[0.9] text-[#fafafa]">
                {headline}
              </h1>
              <h2 className="mt-4 text-[clamp(2rem,8vw,3.5rem)] font-semibold leading-tight text-balance text-[#fafafa]">
                {preview.trip.name}
              </h2>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-[#d4d4d8]">
                <div className="rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 px-4 py-2">
                  {formatInviteDateRange(preview.trip.start_date, preview.trip.end_date)}
                </div>
                <div className="rounded-full border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 px-4 py-2">
                  {preview.trip.location_name || "Location coming together"}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <OrganizerAvatar
                  avatarUrl={preview.organizer.avatarUrl}
                  displayName={preview.organizer.displayName}
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Hosted by</p>
                  <p className="text-base font-semibold text-[#fafafa]">{organizerName}</p>
                </div>
              </div>

              <div className="mt-8 max-w-xl">
                <LoginButton
                  buttonClassName="min-h-14 bg-[image:var(--accent-gradient)] px-6 py-4 text-lg text-white hover:brightness-110 focus:ring-[#8b5cf6]/20"
                  buttonLabel={buttonLabel}
                  containerClassName="max-w-none"
                  redirectTo={redirectPath}
                />
                <p className="mt-4 text-sm leading-6 text-[#d4d4d8]">{subtitle}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes inviteFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -18px, 0) scale(1.04); }
        }
      `}</style>
    </>
  );
}
