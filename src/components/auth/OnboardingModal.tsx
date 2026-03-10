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
        avatarUrl = data.publicUrl;
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
    <div className="fixed inset-0 z-50 flex items-end bg-stone-950/40 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <div className="w-full rounded-[2rem] border border-white/70 bg-[rgba(255,249,245,0.98)] p-5 shadow-[0_24px_80px_rgba(99,46,25,0.22)] sm:max-w-lg sm:p-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b56445]">
            First things first
          </p>
          <h2 className="font-display text-3xl leading-none text-[#34180f] sm:text-4xl">
            Make your profile feel like you
          </h2>
          <p className="text-sm leading-6 text-[#6f4a3b]">
            This shows up across every trip, so set your name and a photo once and you are
            good to go.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.75rem] bg-[linear-gradient(135deg,#ffd4be,#f4a77f)] text-2xl font-semibold text-[#5a2b1c] shadow-inner">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{(displayName.trim() || user.email || "Y").charAt(0).toUpperCase()}</span>
              )}
            </div>

            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-[#d4a189] bg-white px-4 py-3 text-sm font-semibold text-[#5a2b1c] shadow-sm transition hover:border-[#b56445] hover:bg-[#fff4ec]">
              Choose photo
              <input
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="sr-only"
                type="file"
                onChange={(event) => {
                  handleFileChange(event.target.files?.[0] ?? null);
                }}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[#5a2b1c]">Display name</span>
            <input
              className="min-h-12 w-full rounded-[1.25rem] border border-[#e7c4b3] bg-white px-4 py-3 text-base text-[#34180f] outline-none transition placeholder:text-[#b78872] focus:border-[#b56445] focus:ring-2 focus:ring-[#ffd2bd]"
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
            <div className="rounded-[1.25rem] border border-[#efb9a3] bg-[#fff1ea] px-4 py-3 text-sm text-[#8b3f22]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex justify-end">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#c85f37] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(200,95,55,0.32)] transition hover:bg-[#b95430] disabled:cursor-not-allowed disabled:opacity-70"
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
