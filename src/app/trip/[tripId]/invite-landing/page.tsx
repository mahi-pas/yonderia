import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginButton from "@/components/auth/LoginButton";
import { getInvitePreview } from "@/lib/trips";
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
    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/35 bg-white/20 shadow-[0_10px_30px_rgba(23,8,4,0.18)]">
      {avatarUrl ? (
        <Image alt={`${displayName || "Host"} avatar`} className="object-cover" fill sizes="48px" src={avatarUrl} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,236,224,0.92),rgba(255,198,169,0.75))] text-base font-semibold text-[#6d2f1d]">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

function InvalidInviteState() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ffe0ce_0%,#fff4ed_40%,#fff9f5_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.7),transparent_24%),radial-gradient(circle_at_80%_15%,rgba(255,220,202,0.55),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(214,124,88,0.12),transparent_32%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <section className="w-full rounded-[2rem] border border-white/75 bg-white/80 p-7 text-center shadow-[0_30px_90px_rgba(115,52,26,0.16)] backdrop-blur sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b56445]">Invite link</p>
          <h1 className="mt-4 font-display text-4xl leading-none text-[#34180f]">
            This invite link is no longer valid
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#6f4a3b]">
            It may have expired or been turned off by the organizer. You can ask them for a fresh link.
          </p>
          <Link
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#c76038] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(199,96,56,0.28)] transition hover:bg-[#b55531]"
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
      <main className="relative min-h-screen overflow-hidden bg-[#25110d] px-3 py-3 sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-12 top-20 h-40 w-40 rounded-full bg-[#ffbf9b]/20 blur-3xl"
            style={{ animation: "inviteFloat 13s ease-in-out infinite" }}
          />
          <div
            className="absolute right-0 top-8 h-52 w-52 rounded-full bg-[#ffd7c2]/14 blur-3xl"
            style={{ animation: "inviteFloat 17s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute bottom-6 left-1/4 h-48 w-48 rounded-full bg-[#ff8d63]/14 blur-3xl"
            style={{ animation: "inviteFloat 15s ease-in-out infinite" }}
          />
          {[...Array(14)].map((_, index) => (
            <span
              key={`confetti-${index}`}
              className="absolute block rounded-full bg-white/55"
              style={{
                animation: `inviteConfetti ${10 + (index % 5) * 1.5}s linear infinite`,
                animationDelay: `${index * 0.6}s`,
                height: `${6 + (index % 3) * 4}px`,
                left: `${5 + index * 6.5}%`,
                opacity: 0.45,
                top: `${10 + (index % 4) * 18}%`,
                width: `${6 + ((index + 1) % 3) * 4}px`,
              }}
            />
          ))}
        </div>

        <section className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#2c1712] shadow-[0_35px_100px_rgba(0,0,0,0.35)] sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2.5rem]">
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
              <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,#ffd9c5_0%,rgba(255,217,197,0.24)_22%,transparent_38%),radial-gradient(circle_at_80%_15%,rgba(255,190,150,0.28),transparent_24%),linear-gradient(135deg,#d57449,#7a3522_58%,#351612_100%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,8,6,0.2)_0%,rgba(20,8,6,0.34)_28%,rgba(20,8,6,0.7)_62%,rgba(20,8,6,0.92)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,232,220,0.14),transparent_28%)]" />
          </div>

          <div className="relative flex w-full flex-col justify-end p-5 sm:p-8 lg:p-10">
            <div className="max-w-2xl rounded-[1.8rem] border border-white/14 bg-[linear-gradient(180deg,rgba(53,23,16,0.38),rgba(20,8,6,0.62))] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/72">Yonderia invite</p>
              <h1 className="mt-4 font-display text-[clamp(2.9rem,12vw,5.2rem)] leading-[0.9] text-[#fff5ee]">
                {headline}
              </h1>
              <h2 className="mt-4 text-[clamp(2rem,8vw,3.5rem)] font-semibold leading-tight text-balance text-white">
                {preview.trip.name}
              </h2>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/90">
                <div className="rounded-full border border-white/16 bg-white/10 px-4 py-2">
                  {formatInviteDateRange(preview.trip.start_date, preview.trip.end_date)}
                </div>
                <div className="rounded-full border border-white/16 bg-white/10 px-4 py-2">
                  {preview.trip.location_name || "Location coming together"}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <OrganizerAvatar
                  avatarUrl={preview.organizer.avatarUrl}
                  displayName={preview.organizer.displayName}
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Hosted by</p>
                  <p className="text-base font-semibold text-white">{organizerName}</p>
                </div>
              </div>

              <div className="mt-8 max-w-xl">
                <LoginButton
                  buttonClassName="min-h-14 bg-[#f07d51] px-6 py-4 text-lg shadow-[0_22px_60px_rgba(240,125,81,0.4)] hover:bg-[#e36f43] focus:ring-[#ffd8c8]"
                  buttonLabel={buttonLabel}
                  containerClassName="max-w-none"
                  redirectTo={redirectPath}
                />
                <p className="mt-4 text-sm leading-6 text-white/76">{subtitle}</p>
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

        @keyframes inviteConfetti {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.55; }
          50% { transform: translate3d(12px, 28px, 0) rotate(120deg); opacity: 0.45; }
          100% { transform: translate3d(-10px, 64px, 0) rotate(220deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}
