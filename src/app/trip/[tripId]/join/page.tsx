import { redirect } from "next/navigation";
import JoinTripFlow from "@/components/trip/JoinTripFlow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getInviteCodeLookup, getParticipantMembership } from "@/lib/trips";

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

function buildJoinPath(tripId: string, code: string | null): string {
  return code ? `/trip/${tripId}/join?code=${encodeURIComponent(code)}` : `/trip/${tripId}/join`;
}

export default async function TripJoinPage({ params, searchParams }: PageProps) {
  const { tripId } = await params;
  const resolvedSearchParams = await searchParams;
  const code = normalizeCodeParam(resolvedSearchParams.code);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let autoSubmitCode: string | null = null;
  let initialErrorMessage: string | null = null;

  if (code) {
    const adminSupabase = createAdminClient();
    const inviteCode = await getInviteCodeLookup(adminSupabase, tripId, code);

    if (!inviteCode) {
      initialErrorMessage = "That invite code is invalid or no longer active.";
    } else if (inviteCode.codeType === "view") {
      initialErrorMessage = "That code is view-only. Use a join invite to become a participant.";
    } else if (!user) {
      redirect(`/auth/login?redirectTo=${encodeURIComponent(buildJoinPath(tripId, code))}`);
    } else {
      const membership = await getParticipantMembership(adminSupabase, tripId, user.id);

      if (membership) {
        redirect(`/trip/${tripId}`);
      }

      autoSubmitCode = code;
    }
  } else {
    if (!user) {
      return (
        <JoinTripFlow autoSubmitCode={autoSubmitCode} initialErrorMessage={initialErrorMessage} tripId={tripId} />
      );
    }

    const membership = await getParticipantMembership(createAdminClient(), tripId, user.id);

    if (membership) {
      redirect(`/trip/${tripId}`);
    }
  }

  return (
    <JoinTripFlow autoSubmitCode={autoSubmitCode} initialErrorMessage={initialErrorMessage} tripId={tripId} />
  );
}
