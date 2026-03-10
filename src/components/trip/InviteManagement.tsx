"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { InviteCodeType, TripParticipantRole } from "@/lib/types";
import { generateInviteCode } from "@/lib/utils";

type InviteRow = {
  code: string;
  codeType: InviteCodeType;
  createdAt: string;
  createdBy: string | null;
  creatorName: string;
  id: string;
  isActive: boolean;
};

type InviteManagementProps = {
  currentUserDisplayName: string | null;
  currentUserId: string;
  currentUserRole: TripParticipantRole;
  invites: InviteRow[];
  siteOrigin: string;
  tripId: string;
};

type ToastState = {
  message: string;
  tone: "error" | "success";
} | null;

const TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: InviteCodeType;
}> = [
  {
    description: "Recipient signs in and joins as a member.",
    label: "Join as Member",
    value: "join",
  },
  {
    description: "Recipient signs in and lands with planner access.",
    label: "Join as Planner",
    value: "join_planner",
  },
  {
    description: "Recipient can view the trip without logging in.",
    label: "View Only",
    value: "view",
  },
];

function buildInviteLink(siteOrigin: string, tripId: string, code: string): string {
  return `${siteOrigin}/trip/${tripId}?code=${code}`;
}

function getInviteBadge(codeType: InviteCodeType): {
  className: string;
  label: string;
} {
  if (codeType === "join") {
    return {
      className: "border-[#9cd09a] bg-[#eefdea] text-[#2f6b2f]",
      label: "Join",
    };
  }

  if (codeType === "join_planner") {
    return {
      className: "border-[#9dbcf7] bg-[#edf3ff] text-[#2d518f]",
      label: "Planner",
    };
  }

  return {
    className: "border-[#d8d4cf] bg-[#f5f3f1] text-[#655d57]",
    label: "View Only",
  };
}

function formatCreatedDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function truncateCode(code: string): string {
  if (code.length <= 8) {
    return code;
  }

  return `${code.slice(0, 4)}…${code.slice(-3)}`;
}

export default function InviteManagement({
  currentUserDisplayName,
  currentUserId,
  currentUserRole,
  invites: initialInvites,
  siteOrigin,
  tripId,
}: InviteManagementProps) {
  const supabase = useMemo(() => createClient(), []);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<InviteCodeType>("join");
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevokedOpen, setIsRevokedOpen] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteRow | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const canRevoke = currentUserRole === "organizer" || currentUserRole === "planner";

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const activeInvites = useMemo(() => invites.filter((invite) => invite.isActive), [invites]);
  const revokedInvites = useMemo(() => invites.filter((invite) => !invite.isActive), [invites]);

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setToast({
        message: "Invite link copied.",
        tone: "success",
      });
    } catch {
      setToast({
        message: "We couldn't copy that link from this browser.",
        tone: "error",
      });
    }
  }

  async function generateInvite() {
    setIsGenerating(true);
    setToast(null);

    const code = generateInviteCode();

    try {
      // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
      const { data, error } = await supabase
        .from("invite_codes")
        .insert({
          code,
          code_type: inviteType,
          created_by: currentUserId,
          is_active: true,
          trip_id: tripId,
        })
        .select("id, code, code_type, is_active, created_at, created_by")
        .single();

      if (error || !data) {
        throw error ?? new Error("We couldn't create a new invite.");
      }

      const nextInvite: InviteRow = {
        code: data.code,
        codeType: data.code_type,
        createdAt: data.created_at,
        createdBy: data.created_by,
        creatorName: currentUserDisplayName?.trim() || "You",
        id: data.id,
        isActive: data.is_active,
      };
      const nextLink = buildInviteLink(siteOrigin, tripId, data.code);

      setInvites((current) => [nextInvite, ...current]);
      setGeneratedLink(nextLink);
      setToast({
        message: "New invite generated.",
        tone: "success",
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "We couldn't create a new invite.",
        tone: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function revokeInvite() {
    if (!revokeTarget) {
      return;
    }

    setPendingInviteId(revokeTarget.id);

    try {
      const response = await fetch("/api/invites/revoke", {
        body: JSON.stringify({
          inviteId: revokeTarget.id,
          tripId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "We couldn't revoke that invite.");
      }

      setInvites((current) =>
        current.map((invite) => (invite.id === revokeTarget.id ? { ...invite, isActive: false } : invite)),
      );
      setToast({
        message: "Invite revoked.",
        tone: "success",
      });
      setRevokeTarget(null);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "We couldn't revoke that invite.",
        tone: "error",
      });
    } finally {
      setPendingInviteId(null);
    }
  }

  return (
    <>
      {toast ? (
        <div className="fixed inset-x-4 top-4 z-50 flex justify-center">
          <div
            className={[
              "w-full max-w-md rounded-[1.35rem] px-4 py-3 text-sm font-semibold shadow-[0_18px_45px_rgba(90,40,20,0.18)]",
              toast.tone === "success"
                ? "border border-[#cfe4c7] bg-[#f4fff0] text-[#355722]"
                : "border border-[#efb9a3] bg-[#fff1ea] text-[#8b3f22]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <div className="space-y-5">
        <section className="rounded-[2rem] border border-[#efd5c8] bg-white/80 p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Generate New Invite</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Share the trip</h2>

          <div className="mt-5 space-y-3">
            {TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={[
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-[1.4rem] border px-4 py-3 transition",
                  inviteType === option.value
                    ? "border-[#c76038] bg-[#fff2ea] shadow-sm"
                    : "border-[#ecd1c3] bg-[#fffdfb] hover:bg-[#fff6f0]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  checked={inviteType === option.value}
                  className="mt-1 h-4 w-4 accent-[#c76038]"
                  name="invite-type"
                  type="radio"
                  value={option.value}
                  onChange={() => {
                    setInviteType(option.value);
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#34180f]">{option.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-[#7c5a4c]">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          <Button
            className="mt-5 w-full sm:w-auto"
            isLoading={isGenerating}
            size="lg"
            onClick={() => void generateInvite()}
          >
            {isGenerating ? "Generating..." : "Generate invite"}
          </Button>

          {generatedLink ? (
            <div className="mt-5 rounded-[1.5rem] border border-[#f0d5c7] bg-[linear-gradient(180deg,#fffdfb,#fff5ef)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#34180f]">Newest link</p>
              <p className="mt-2 break-all text-sm leading-6 text-[#6f4a3b]">{generatedLink}</p>
              <Button
                className="mt-4 w-full sm:w-auto"
                variant="secondary"
                onClick={() => void copyLink(generatedLink)}
              >
                Copy link
              </Button>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-[#efd5c8] bg-white/80 p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Active Invites</p>
              <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Live links</h2>
            </div>
            <p className="text-sm text-[#7e5b4c]">{activeInvites.length} active</p>
          </div>

          {activeInvites.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#e2b7a4] bg-[linear-gradient(180deg,#fff8f4,#fff2ea)] px-5 py-6 text-sm leading-6 text-[#7f5d50]">
              No active invites yet. Generate one above when you&apos;re ready to share the trip.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {activeInvites.map((invite) => {
                const badge = getInviteBadge(invite.codeType);
                const fullLink = buildInviteLink(siteOrigin, tripId, invite.code);

                return (
                  <li
                    key={invite.id}
                    className="rounded-[1.6rem] border border-[#f0d5c7] bg-[linear-gradient(180deg,#fffdfb,#fff5ef)] p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-[#34180f]">
                            {truncateCode(invite.code)}
                          </span>
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="break-all text-sm leading-6 text-[#6f4a3b]">{fullLink}</p>
                        <p className="text-sm text-[#8a6759]">
                          Created {formatCreatedDate(invite.createdAt)} by {invite.creatorName}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className="flex-1 sm:flex-none"
                          variant="secondary"
                          onClick={() => void copyLink(fullLink)}
                        >
                          Copy
                        </Button>
                        {canRevoke ? (
                          <Button
                            className="flex-1 sm:flex-none"
                            variant="ghost"
                            onClick={() => {
                              setRevokeTarget(invite);
                            }}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[2rem] border border-[#efd5c8] bg-white/80 p-4 shadow-sm sm:p-5">
          <button
            className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
            type="button"
            onClick={() => {
              setIsRevokedOpen((current) => !current);
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">Revoked Invites</p>
              <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Past links</h2>
            </div>
            <span className="text-sm font-semibold text-[#7e5b4c]">{isRevokedOpen ? "Hide" : "Show"}</span>
          </button>

          {isRevokedOpen ? (
            revokedInvites.length === 0 ? (
              <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#ddd1ca] bg-[#faf7f5] px-5 py-6 text-sm leading-6 text-[#8d847d]">
                No revoked invites yet.
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {revokedInvites.map((invite) => {
                  const badge = getInviteBadge(invite.codeType);

                  return (
                    <li
                      key={invite.id}
                      className="rounded-[1.6rem] border border-[#e6ddd8] bg-[#f7f4f2] p-4 text-[#817871]"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{truncateCode(invite.code)}</span>
                        <span
                          className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold opacity-80 ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">
                        Created {formatCreatedDate(invite.createdAt)} by {invite.creatorName}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </section>
      </div>

      <Modal
        description={
          revokeTarget
            ? `Revoke ${truncateCode(revokeTarget.code)}? Anyone using that link will stop getting access immediately.`
            : undefined
        }
        isOpen={Boolean(revokeTarget)}
        onClose={() => {
          if (!pendingInviteId) {
            setRevokeTarget(null);
          }
        }}
        panelClassName="sm:max-w-xl"
        title="Revoke invite"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={Boolean(pendingInviteId)}
              variant="secondary"
              onClick={() => {
                setRevokeTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button isLoading={Boolean(pendingInviteId)} onClick={() => void revokeInvite()}>
              Revoke invite
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-[#6f4a3b]">
          The link won&apos;t work again unless you create a fresh invite.
        </p>
      </Modal>
    </>
  );
}
