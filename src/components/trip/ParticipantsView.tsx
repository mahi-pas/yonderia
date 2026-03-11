"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import TopToast from "@/components/ui/TopToast";
import { createClient } from "@/lib/supabase/client";
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
      className: "border-[#4d2619] bg-[#4d2619] text-[#ffe8c7]",
      label: "♛ Organizer",
    };
  }

  if (role === "planner") {
    return {
      className: "border-[#2d518f] bg-[#eaf1ff] text-[#2d518f]",
      label: "★ Planner",
    };
  }

  return {
    className: "border-[#dcc1b5] bg-[#fff9f5] text-[#7b5648]",
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

      <section className="rounded-[2rem] border border-[#efd5c8] bg-white/80 p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">People</p>
            <h2 className="mt-1 font-display text-3xl leading-none text-[#34180f]">Your crew</h2>
          </div>
          <p className="text-sm text-[#7e5b4c]">{participants.length} total</p>
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
                className="relative rounded-[1.6rem] border border-[#f0d5c7] bg-[linear-gradient(180deg,#fffdfb,#fff5ef)] p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Link
                    aria-label={`View ${participant.nickname}'s profile`}
                    className="inline-flex min-h-11 min-w-11 shrink-0 rounded-full"
                    href={`/profile/${participant.userId}`}
                  >
                    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f6c4a7] text-base font-semibold text-[#5a2b1c] shadow-[0_12px_22px_rgba(116,58,31,0.14)]">
                      {participant.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={participant.nickname}
                          className="h-full w-full object-cover"
                          src={participant.avatarUrl}
                        />
                      ) : (
                        <span>{getInitials(participant.nickname)}</span>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-[#34180f]">{participant.nickname}</p>
                      <span
                        className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${roleBadge.className}`}
                      >
                        {roleBadge.label}
                      </span>
                    </div>

                    {shouldShowDisplayName(participant) ? (
                      <p className="mt-1 text-sm text-[#8a6759]">{participant.displayName}</p>
                    ) : null}

                    <p className="mt-2 text-sm leading-6 text-[#6f4a3b]">{formatTravelSummary(participant)}</p>
                  </div>

                  {showActions ? (
                    <div className="relative shrink-0">
                      <button
                        aria-label={`Open actions for ${participant.nickname}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#ebc5b5] bg-white text-xl text-[#6b4131] transition hover:bg-[#fff3eb] disabled:opacity-60"
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
                        <div className="absolute right-0 top-12 z-10 w-48 rounded-[1.25rem] border border-[#efd5c8] bg-white p-2 shadow-[0_18px_45px_rgba(90,40,20,0.18)]">
                          {canChangeRole && participant.role !== "planner" ? (
                            <button
                              className="flex min-h-11 w-full items-center rounded-[1rem] px-3 text-left text-sm font-semibold text-[#34180f] transition hover:bg-[#fff4ec]"
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
                              className="flex min-h-11 w-full items-center rounded-[1rem] px-3 text-left text-sm font-semibold text-[#34180f] transition hover:bg-[#fff4ec]"
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
                              className="flex min-h-11 w-full items-center rounded-[1rem] px-3 text-left text-sm font-semibold text-[#34180f] transition hover:bg-[#fff4ec]"
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
                              className="flex min-h-11 w-full items-center rounded-[1rem] px-3 text-left text-sm font-semibold text-[#a33d24] transition hover:bg-[#fff1ea]"
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
        <p className="text-sm leading-6 text-[#6f4a3b]">
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
