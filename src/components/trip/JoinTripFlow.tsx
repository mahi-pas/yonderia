"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import NicknameModal from "@/components/trip/NicknameModal";

type JoinTripFlowProps = {
  autoSubmitCode: string | null;
  initialErrorMessage?: string | null;
  tripId: string;
};

type ValidateInviteResponse = {
  alreadyParticipant?: boolean;
  error?: string;
  participantId?: string;
  redirectTo?: string;
  success?: boolean;
  tripId?: string;
};

type SubmissionMode = "auto" | "idle" | "manual";

function normalizeCode(code: string): string {
  return code.trim();
}

export default function JoinTripFlow({
  autoSubmitCode,
  initialErrorMessage = null,
  tripId,
}: JoinTripFlowProps) {
  const router = useRouter();
  const hasAutoSubmittedRef = useRef(false);
  const [code, setCode] = useState(autoSubmitCode ?? "");
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState(`/trip/${tripId}`);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(
    autoSubmitCode && !initialErrorMessage ? "auto" : "idle",
  );

  const normalizedCode = useMemo(() => normalizeCode(code), [code]);
  const isAutoValidating = submissionMode === "auto";
  const isSubmitting = submissionMode !== "idle";

  const completeJoinFlow = useCallback(() => {
    router.replace(redirectTo);
  }, [redirectTo, router]);

  const submitCode = useCallback(
    async (rawCode: string, mode: Exclude<SubmissionMode, "idle">) => {
      const trimmedCode = normalizeCode(rawCode);

      if (!trimmedCode) {
        setErrorMessage("Enter an invite code to join this trip.");
        setSubmissionMode("idle");
        return;
      }

      setSubmissionMode(mode);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/invite/validate", {
          body: JSON.stringify({
            code: trimmedCode,
            tripId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        const data = (await response.json().catch(() => null)) as ValidateInviteResponse | null;

        if (response.status === 401) {
          const loginRedirect = `/auth/login?redirectTo=${encodeURIComponent(`/trip/${tripId}/join?code=${trimmedCode}`)}`;
          router.replace(loginRedirect);
          return;
        }

        if (!response.ok || !data?.success) {
          throw new Error(data?.error ?? "We couldn't validate that invite code.");
        }

        const nextRedirectTo = data.redirectTo ?? `/trip/${tripId}`;

        setRedirectTo(nextRedirectTo);

        if (data.alreadyParticipant) {
          router.replace(nextRedirectTo);
          return;
        }

        if (!data.participantId) {
          throw new Error("Your trip access was created, but the participant record is missing.");
        }

        setParticipantId(data.participantId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "We couldn't validate that invite code.",
        );
      } finally {
        setSubmissionMode("idle");
      }
    },
    [router, tripId],
  );

  useEffect(() => {
    if (!autoSubmitCode || initialErrorMessage || hasAutoSubmittedRef.current) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    void submitCode(autoSubmitCode, "auto");
  }, [autoSubmitCode, initialErrorMessage, submitCode]);

  if (isAutoValidating && !participantId) {
    return (
      <>
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-10">
          <div className="mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-6 shadow-[0_28px_90px_rgba(104,45,20,0.12)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Join trip</p>
            <h1 className="mt-3 font-display text-4xl leading-none text-[#34180f]">Checking your invite</h1>
            <p className="mt-3 text-sm leading-6 text-[#6f4a3b]">
              We&apos;re validating your code and getting your spot ready.
            </p>

            <div className="mt-8 flex items-center gap-3 rounded-[1.5rem] border border-[#efd5c8] bg-white/80 px-4 py-4 text-sm text-[#6f4a3b]">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e2b4a2] border-t-[#c76038]" />
              <span>Validating invite code...</span>
            </div>
          </div>
        </main>

        {participantId ? (
          <NicknameModal
            isOpen
            participantId={participantId}
            tripId={tripId}
            onComplete={completeJoinFlow}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffe1d0_0%,#fff8f4_42%,#fff6ef_100%)] px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-10">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,250,246,0.95),rgba(255,245,237,0.92))] p-6 shadow-[0_28px_90px_rgba(104,45,20,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Trip access</p>
          <h1 className="mt-3 font-display text-4xl leading-none text-[#34180f]">Join this trip</h1>
          <p className="mt-3 text-sm leading-6 text-[#6f4a3b]">
            Drop in a join code and we&apos;ll bring you straight to the plan.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCode(code, "manual");
            }}
          >
            <Input
              autoCapitalize="off"
              autoCorrect="off"
              disabled={isSubmitting}
              hint="View-only codes won't work here. Use a join invite instead."
              label="Invite code"
              placeholder="abc123join"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
            />

            {errorMessage ? (
              <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
                {errorMessage}
              </div>
            ) : null}

            <div className="sticky bottom-3 z-10 -mx-1 rounded-[1.5rem] border border-white/80 bg-[rgba(255,249,245,0.96)] p-3 shadow-[0_16px_35px_rgba(90,40,20,0.12)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
              <Button
                className="w-full"
                disabled={!normalizedCode}
                isLoading={submissionMode === "manual"}
                size="lg"
                type="submit"
              >
                {submissionMode === "manual" ? "Joining..." : "Join trip"}
              </Button>
            </div>
          </form>
        </div>
      </main>

      {participantId ? (
        <NicknameModal isOpen participantId={participantId} tripId={tripId} onComplete={completeJoinFlow} />
      ) : null}
    </>
  );
}
