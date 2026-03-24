"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { deleteOldAvatarFiles } from "@/lib/avatars";
import { avatarImageReferrerPolicy } from "@/lib/avatar-image";
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

        await deleteOldAvatarFiles(supabase, user.id, filePath);

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
    <div className="fixed inset-0 z-50 flex items-end bg-[#121212]/60 sm:items-center sm:justify-center sm:p-6">
      <div className="relative flex h-[100dvh] w-full flex-col border-2 sm:border-4 border-[#121212] bg-white p-5 shadow-[8px_8px_0px_0px_black] sm:h-auto sm:max-w-lg sm:p-8">
        {/* Red accent stripe */}
        <div className="absolute inset-x-0 top-0 h-2 bg-[#D02020]" />

        <div className="space-y-2 pt-2">
          <div className="mx-auto mb-4 h-1.5 w-14 bg-[#121212] sm:hidden" />
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">
            First things first
          </p>
          <h2 className="font-display text-3xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-4xl">
            Make your profile feel like you
          </h2>
          <p className="text-sm font-medium leading-6 text-[#888888]">
            This shows up across every trip, so set your name and a photo once and you are
            good to go.
          </p>
        </div>

        <div className="mt-6 flex-1 space-y-5 overflow-y-auto pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden border-2 border-[#121212] bg-[#F0C020] text-2xl font-black">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className="h-full w-full object-cover"
                  referrerPolicy={avatarImageReferrerPolicy}
                />
              ) : (
                <span className="text-[#121212]">{(displayName.trim() || user.email || "Y").charAt(0).toUpperCase()}</span>
              )}
            </div>

            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center border-2 border-[#121212] bg-white px-4 py-3 text-sm font-bold uppercase tracking-wider text-[#121212] shadow-[3px_3px_0px_0px_black] transition hover:bg-[#F0C020] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
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
            <span className="mb-2 block text-sm font-bold uppercase tracking-widest text-[#121212]">Display name</span>
            <input
              className="min-h-12 w-full border-2 border-[#121212] bg-white px-4 py-3 text-base font-medium text-[#121212] outline-none transition placeholder:text-[#888888] focus:ring-2 focus:ring-[#1040C0]"
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
            <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-medium text-[#D02020]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex justify-end border-t-2 border-[#121212] pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:border-0 sm:pt-0 sm:pb-0">
          <button
            className="inline-flex min-h-11 w-full items-center justify-center border-2 border-[#121212] bg-[#D02020] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[4px_4px_0px_0px_black] transition duration-200 hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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
