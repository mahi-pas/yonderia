"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import TopToast from "@/components/ui/TopToast";
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

type InsertedInviteRow = {
  code: string;
  code_type: InviteCodeType;
  created_at: string;
  created_by: string | null;
  id: string;
  is_active: boolean;
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
      className: "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#86efac]",
      label: "Join",
    };
  }

  if (codeType === "join_planner") {
    return {
      className: "border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#a78bfa]",
      label: "Planner",
    };
  }

  return {
    className: "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--muted)]",
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
      const inviteInsertQuery = supabase.from("invite_codes");
      const { data, error } = await inviteInsertQuery
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
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

      const insertedInvite = data as InsertedInviteRow;
      const nextInvite: InviteRow = {
        code: insertedInvite.code,
        codeType: insertedInvite.code_type,
        createdAt: insertedInvite.created_at,
        createdBy: insertedInvite.created_by,
        creatorName: currentUserDisplayName?.trim() || "You",
        id: insertedInvite.id,
        isActive: insertedInvite.is_active,
      };
      const nextLink = buildInviteLink(siteOrigin, tripId, insertedInvite.code);

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
        <TopToast message={toast.message} tone={toast.tone} />
      ) : null}

      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide gradient-text">Generate New Invite</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-[#fafafa]">Share the trip</h2>

          <div className="mt-5 space-y-3">
            {TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={[
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition",
                  inviteType === option.value
                    ? "border-[#8b5cf6] bg-[var(--surface-elevated)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  checked={inviteType === option.value}
                  className="mt-1 h-4 w-4 accent-[#8b5cf6]"
                  name="invite-type"
                  type="radio"
                  value={option.value}
                  onChange={() => {
                    setInviteType(option.value);
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#fafafa]">{option.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-[#d4d4d8]">{option.description}</span>
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
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm">
              <p className="text-sm font-semibold text-[#fafafa]">Newest link</p>
              <p className="mt-2 break-all text-sm leading-6 text-[#d4d4d8]">{generatedLink}</p>
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

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide gradient-text">Active Invites</p>
              <h2 className="mt-1 font-display text-3xl leading-none text-[#fafafa]">Live links</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">{activeInvites.length} active</p>
          </div>

          {activeInvites.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-6 text-sm leading-6 text-[var(--muted)]">
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
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-[#fafafa]">
                            {truncateCode(invite.code)}
                          </span>
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="break-all text-sm leading-6 text-[#d4d4d8]">{fullLink}</p>
                        <p className="text-sm text-[var(--muted)]">
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

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <button
            className="flex min-h-11 w-full items-center justify-between gap-4 text-left"
            type="button"
            onClick={() => {
              setIsRevokedOpen((current) => !current);
            }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide gradient-text">Revoked Invites</p>
              <h2 className="mt-1 font-display text-3xl leading-none text-[#fafafa]">Past links</h2>
            </div>
            <span className="text-sm font-semibold text-[var(--muted)]">{isRevokedOpen ? "Hide" : "Show"}</span>
          </button>

          {isRevokedOpen ? (
            revokedInvites.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-6 text-sm leading-6 text-[var(--muted-foreground)]">
                No revoked invites yet.
              </div>
            ) : (
              <ul className="mt-5 space-y-3">
                {revokedInvites.map((invite) => {
                  const badge = getInviteBadge(invite.codeType);

                  return (
                    <li
                      key={invite.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 text-[var(--muted-foreground)] backdrop-blur-sm"
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
        <p className="text-sm leading-6 text-[#d4d4d8]">
          The link won&apos;t work again unless you create a fresh invite.
        </p>
      </Modal>
    </>
  );
}
