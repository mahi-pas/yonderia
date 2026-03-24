"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { avatarImageReferrerPolicy } from "@/lib/avatar-image";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import TopToast from "@/components/ui/TopToast";
import { createClient } from "@/lib/supabase/client";
import { buildProfileHref } from "@/lib/trip-navigation";
import type { TripParticipantRole } from "@/lib/types";

type ParticipantRow = {
  arrivalLocation: string | null;
  arrivalTime: string | null;
  avatarUrl: string | null;
  departureLocation: string | null;
  departureTime: string | null;
  displayName: string | null;
  nickname: string;
  participantId: string;
  role: TripParticipantRole;
  userId: string;
};

type ParticipantsViewProps = {
  currentUserId: string;
  currentUserRole: TripParticipantRole;
  participants: ParticipantRow[];
  tripId: string;
};

type ToastState = {
  message: string;
  tone: "error" | "success";
} | null;

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatTravelMoment(prefix: string, time: string | null, location: string | null): string | null {
  const trimmedLocation = location?.trim() ?? "";

  if (time) {
    const parsed = parseISO(time);

    if (isValid(parsed)) {
      return trimmedLocation
        ? `${prefix} ${format(parsed, "EEE h:mm a")} at ${trimmedLocation}`
        : `${prefix} ${format(parsed, "EEE h:mm a")}`;
    }
  }

  if (trimmedLocation) {
    return `${prefix} at ${trimmedLocation}`;
  }

  return null;
}

function formatTravelSummary(participant: ParticipantRow): string {
  const arrivalSummary = formatTravelMoment("Arriving", participant.arrivalTime, participant.arrivalLocation);
  const departureSummary = formatTravelMoment("Leaving", participant.departureTime, participant.departureLocation);

  if (arrivalSummary && departureSummary) {
    return `${arrivalSummary} • ${departureSummary}`;
  }

  return arrivalSummary ?? departureSummary ?? "Arrival and departure details haven't been added yet.";
}

function getRoleBadge(role: TripParticipantRole): {
  className: string;
  label: string;
} {
  if (role === "organizer") {
    return {
      className: "border-2 border-[#121212] bg-[#F0C020]/40 text-[var(--trip-paper-text,#121212)]",
      label: "♛ Organizer",
    };
  }

  if (role === "planner") {
    return {
      className: "border-2 border-[#121212] bg-[#D02020]/15 text-[#D02020]",
      label: "★ Planner",
    };
  }

  return {
    className: "border-2 border-[#121212] bg-[#F8F8F8] text-[var(--trip-paper-muted,#666666)]",
    label: "Member",
  };
}

function shouldShowDisplayName(participant: ParticipantRow): boolean {
  const nickname = participant.nickname.trim().toLocaleLowerCase();
  const displayName = participant.displayName?.trim().toLocaleLowerCase();
  return Boolean(displayName && displayName !== nickname);
}

function canKickParticipant(
  currentUserId: string,
  currentUserRole: TripParticipantRole,
  participant: ParticipantRow,
): boolean {
  if (participant.userId === currentUserId) {
    return false;
  }

  if (currentUserRole === "organizer") {
    return participant.role !== "organizer";
  }

  if (currentUserRole === "planner") {
    return participant.role === "member";
  }

  return false;
}

export default function ParticipantsView({
  currentUserId,
  currentUserRole,
  participants,
  tripId,
}: ParticipantsViewProps) {
  const router = useRouter();
  const [confirmKickParticipant, setConfirmKickParticipant] = useState<ParticipantRow | null>(null);
  const [editNameParticipant, setEditNameParticipant] = useState<ParticipantRow | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [menuParticipantId, setMenuParticipantId] = useState<string | null>(null);
  const [pendingParticipantId, setPendingParticipantId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const isOrganizer = currentUserRole === "organizer";

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

  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant.participantId, participant])),
    [participants],
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`participants-page:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `trip_id=eq.${tripId}`,
          schema: "public",
          table: "trip_participants",
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, tripId]);

  async function changeRole(participantId: string, role: Extract<TripParticipantRole, "member" | "planner">) {
    setMenuParticipantId(null);
    setPendingParticipantId(participantId);

    try {
      const response = await fetch("/api/participants/role", {
        body: JSON.stringify({
          participantId,
          role,
          tripId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "We couldn't update that participant's role.");
      }

      setToast({
        message: role === "planner" ? "Participant is now a planner." : "Participant is now a member.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "We couldn't update that participant's role.",
        tone: "error",
      });
    } finally {
      setPendingParticipantId(null);
    }
  }

  async function kickParticipant() {
    if (!confirmKickParticipant) {
      return;
    }

    const participantId = confirmKickParticipant.participantId;
    setPendingParticipantId(participantId);

    try {
      const response = await fetch("/api/participants/kick", {
        body: JSON.stringify({
          participantId,
          tripId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "We couldn't remove that participant.");
      }

      setToast({
        message: "Participant removed from the trip.",
        tone: "success",
      });
      setConfirmKickParticipant(null);
      router.refresh();
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "We couldn't remove that participant.",
        tone: "error",
      });
    } finally {
      setPendingParticipantId(null);
    }
  }

  async function saveNickname() {
    if (!editNameParticipant) {
      return;
    }

    const nextNickname = nicknameDraft.trim();

    if (!nextNickname) {
      setNicknameError("Enter a nickname to save.");
      return;
    }

    if (nextNickname === editNameParticipant.nickname.trim()) {
      setEditNameParticipant(null);
      setNicknameDraft("");
      setNicknameError(null);
      return;
    }

    const previousNickname = editNameParticipant.nickname;
    setPendingParticipantId(editNameParticipant.participantId);
    setNicknameError(null);

    try {
      const response = await fetch("/api/participants/nickname", {
        body: JSON.stringify({
          nickname: nextNickname,
          participantId: editNameParticipant.participantId,
          tripId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "We couldn't update that nickname.");
      }

      setToast({
        message: `Updated ${previousNickname} to ${nextNickname}`,
        tone: "success",
      });
      setEditNameParticipant(null);
      setNicknameDraft("");
      router.refresh();
    } catch (error) {
      setNicknameError(error instanceof Error ? error.message : "We couldn't update that nickname.");
    } finally {
      setPendingParticipantId(null);
    }
  }

  return (
    <>
      {toast ? (
        <TopToast message={toast.message} tone={toast.tone} />
      ) : null}

      <section className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--foreground,#121212)]">People</p>
            <h2 className="mt-1 font-display text-3xl uppercase tracking-tighter font-black leading-[0.9] text-[var(--foreground,#121212)]">
              Your crew
            </h2>
          </div>
          <p className="text-sm text-[var(--muted-foreground,#666666)]">{participants.length} total</p>
        </div>

        <ul className="mt-5 space-y-3">
          {participants.map((participant) => {
            const roleBadge = getRoleBadge(participant.role);
            const canChangeRole = isOrganizer && participant.userId !== currentUserId && participant.role !== "organizer";
            const canKick = canKickParticipant(currentUserId, currentUserRole, participant);
            const showActions = canChangeRole || canKick;
            const isPending = pendingParticipantId === participant.participantId;

            return (
              <li
                key={participant.participantId}
                className="relative border-2 border-[#121212] bg-white p-4 shadow-[4px_4px_0px_0px_black]"
              >
                <div className="flex items-start gap-3">
                  <Link
                    aria-label={`View ${participant.nickname}'s profile`}
                    className="inline-flex min-h-11 min-w-11 shrink-0 rounded-full"
                    href={buildProfileHref(participant.userId, `/trip/${tripId}`)}
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#121212] bg-[#F8F8F8] text-base font-bold text-[var(--trip-paper-muted,#666666)] shadow-[4px_4px_0px_0px_black]">
                      {participant.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={participant.nickname}
                          className="h-full w-full object-cover"
                          referrerPolicy={avatarImageReferrerPolicy}
                          src={participant.avatarUrl}
                        />
                      ) : (
                        <span>{getInitials(participant.nickname)}</span>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-[var(--trip-paper-text,#121212)]">{participant.nickname}</p>
                      <span
                        className={`inline-flex min-h-8 items-center border-2 px-3 text-xs font-bold ${roleBadge.className}`}
                      >
                        {roleBadge.label}
                      </span>
                    </div>

                    {shouldShowDisplayName(participant) ? (
                      <p className="mt-1 text-sm text-[var(--trip-paper-muted,#666666)]">{participant.displayName}</p>
                    ) : null}

                    <p className="mt-2 text-sm leading-6 text-[var(--trip-paper-muted,#666666)]">
                      {formatTravelSummary(participant)}
                    </p>
                  </div>

                  {showActions ? (
                    <div className="relative shrink-0">
                      <button
                        aria-label={`Open actions for ${participant.nickname}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center border-2 border-[#121212] bg-[#F8F8F8] text-xl text-[var(--trip-paper-text,#121212)] transition hover:bg-[#F0F0F0] disabled:opacity-60"
                        disabled={isPending}
                        type="button"
                        onClick={() => {
                          setMenuParticipantId((current) =>
                            current === participant.participantId ? null : participant.participantId,
                          );
                        }}
                      >
                        ⋯
                      </button>

                      {menuParticipantId === participant.participantId ? (
                        <div className="absolute right-0 top-12 z-10 w-48 border-2 border-[#121212] bg-white p-2 shadow-[4px_4px_0px_0px_black]">
                          {canChangeRole && participant.role !== "planner" ? (
                            <button
                              className="flex min-h-11 w-full items-center px-3 text-left text-sm font-bold text-[var(--trip-paper-text,#121212)] transition hover:bg-[#F8F8F8]"
                              type="button"
                              onClick={() => {
                                void changeRole(participant.participantId, "planner");
                              }}
                            >
                              Make Planner
                            </button>
                          ) : null}

                          {canChangeRole && participant.role !== "member" ? (
                            <button
                              className="flex min-h-11 w-full items-center px-3 text-left text-sm font-bold text-[var(--trip-paper-text,#121212)] transition hover:bg-[#F8F8F8]"
                              type="button"
                              onClick={() => {
                                void changeRole(participant.participantId, "member");
                              }}
                            >
                              Make Member
                            </button>
                          ) : null}

                          {isOrganizer ? (
                            <button
                              className="flex min-h-11 w-full items-center px-3 text-left text-sm font-bold text-[var(--trip-paper-text,#121212)] transition hover:bg-[#F8F8F8]"
                              type="button"
                              onClick={() => {
                                setMenuParticipantId(null);
                                setEditNameParticipant(participantMap.get(participant.participantId) ?? null);
                                setNicknameDraft(participant.nickname);
                                setNicknameError(null);
                              }}
                            >
                              Edit Name
                            </button>
                          ) : null}

                          {canKick ? (
                            <button
                              className="flex min-h-11 w-full items-center px-3 text-left text-sm font-bold text-[#D02020] transition hover:bg-[#F8F8F8]"
                              type="button"
                              onClick={() => {
                                setMenuParticipantId(null);
                                setConfirmKickParticipant(participantMap.get(participant.participantId) ?? null);
                              }}
                            >
                              Kick from Trip
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Modal
        description={
          confirmKickParticipant
            ? `Remove ${confirmKickParticipant.nickname} from this trip? They'll lose access to the itinerary and all trip details.`
            : undefined
        }
        isOpen={Boolean(confirmKickParticipant)}
        onClose={() => {
          if (!pendingParticipantId) {
            setConfirmKickParticipant(null);
          }
        }}
        panelClassName="sm:max-w-xl"
        title="Kick participant"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={Boolean(pendingParticipantId)}
              variant="secondary"
              onClick={() => {
                setConfirmKickParticipant(null);
              }}
            >
              Cancel
            </Button>
            <Button isLoading={Boolean(pendingParticipantId)} onClick={() => void kickParticipant()}>
              Remove from trip
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-6 text-[var(--trip-paper-muted,#666666)]">
          This will remove them from the participant list right away.
        </p>
      </Modal>

      <Modal
        description={
          editNameParticipant
            ? `Change the trip nickname everyone sees for ${editNameParticipant.displayName ?? editNameParticipant.nickname}.`
            : undefined
        }
        isOpen={Boolean(editNameParticipant)}
        onClose={() => {
          if (!pendingParticipantId) {
            setEditNameParticipant(null);
            setNicknameDraft("");
            setNicknameError(null);
          }
        }}
        panelClassName="sm:max-w-lg"
        title="Edit nickname"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={Boolean(pendingParticipantId)}
              variant="secondary"
              onClick={() => {
                setEditNameParticipant(null);
                setNicknameDraft("");
                setNicknameError(null);
              }}
            >
              Cancel
            </Button>
            <Button isLoading={Boolean(pendingParticipantId)} onClick={() => void saveNickname()}>
              Save nickname
            </Button>
          </div>
        }
      >
        <Input
          disabled={Boolean(pendingParticipantId)}
          error={nicknameError}
          hint="This only changes how they're labeled on this trip."
          label="Nickname"
          maxLength={60}
          placeholder="Road Runner"
          value={nicknameDraft}
          onChange={(event) => {
            setNicknameDraft(event.target.value);
            if (nicknameError) {
              setNicknameError(null);
            }
          }}
        />
      </Modal>
    </>
  );
}
