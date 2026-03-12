"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/types";

type OnboardingModalProps = {
  onCompleted: (profile: Profile) => void;
  profile: Profile;
  supabase: SupabaseClient<Database>;
  user: User;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const VALID_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getFileExtension(file: File): string {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (fileExtension) {
    return fileExtension;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export default function OnboardingModal({
  onCompleted,
  profile,
  supabase,
  user,
}: OnboardingModalProps) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
  }, [profile.display_name]);

  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }

    return profile.avatar_url;
  }, [profile.avatar_url, selectedFile]);

  useEffect(() => {
    return () => {
      if (selectedFile && previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!VALID_IMAGE_TYPES.has(file.type)) {
      setErrorMessage("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage("Profile photos must be 5MB or smaller.");
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleSave = async () => {
    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setErrorMessage("Add a display name so your crew knows who you are.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      let avatarUrl = profile.avatar_url;

      if (selectedFile) {
        const fileExtension = getFileExtension(selectedFile);
        const filePath = `${user.id}/avatar.${fileExtension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        const separator = data.publicUrl.includes("?") ? "&" : "?";
        avatarUrl = `${data.publicUrl}${separator}v=${Date.now()}`;
      }

      const updates = {
        avatar_url: avatarUrl,
        display_name: trimmedDisplayName,
        has_completed_onboarding: true,
      } satisfies Database["public"]["Tables"]["profiles"]["Update"];

      const profileQuery = supabase.from("profiles");
      const { data, error } = await profileQuery
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        .update(updates)
        .eq("id", user.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      onCompleted(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't save your profile just yet.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-md sm:items-center sm:justify-center sm:p-6">
      <div className="relative flex h-[100dvh] w-full flex-col rounded-t-2xl border border-[var(--border-strong)] bg-[rgba(20,20,31,0.98)] p-5 shadow-[0_8px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:h-auto sm:max-w-lg sm:rounded-2xl sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--accent-gradient)] opacity-40" />
        <div className="space-y-2">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[var(--border-strong)] sm:hidden" />
          <p className="text-xs font-semibold uppercase tracking-wide gradient-text">
            First things first
          </p>
          <h2 className="font-display text-3xl leading-none text-[#fafafa] sm:text-4xl">
            Make your profile feel like you
          </h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            This shows up across every trip, so set your name and a photo once and you are
            good to go.
          </p>
        </div>

        <div className="mt-6 flex-1 space-y-5 overflow-y-auto pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--surface-elevated),var(--surface))] text-2xl font-semibold shadow-inner">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="gradient-text">{(displayName.trim() || user.email || "Y").charAt(0).toUpperCase()}</span>
              )}
            </div>

            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[#d4d4d8] shadow-sm transition hover:border-[#8b5cf6]/50 hover:bg-[var(--surface-elevated)]">
              Choose photo
              <input
                accept="image/*"
                className="sr-only"
                type="file"
                onChange={(event) => {
                  handleFileChange(event.target.files?.[0] ?? null);
                }}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#d4d4d8]">Display name</span>
            <input
              className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[#fafafa] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#8b5cf6]/20"
              maxLength={80}
              placeholder="What should people call you?"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-[#ef4444]/30 bg-[#450a0a]/90 px-4 py-3 text-sm text-[#fca5a5]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex justify-end border-t border-[var(--border)] pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:border-0 sm:pt-0 sm:pb-0">
          <button
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[image:var(--accent-gradient)] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_20px_rgba(139,92,246,0.3)] transition hover:brightness-110 hover:shadow-[0_4px_32px_rgba(139,92,246,0.4)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            disabled={isSaving}
            type="button"
            onClick={() => {
              void handleSave();
            }}
          >
            {isSaving ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
