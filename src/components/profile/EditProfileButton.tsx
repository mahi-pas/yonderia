"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ImageUploader from "@/components/ui/ImageUploader";
import { deleteOldAvatarFiles } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types";

type EditProfileButtonProps = {
  initialAvatarUrl: string | null;
  initialDisplayName: string | null;
  userId: string;
};

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function EditProfileButton({
  initialAvatarUrl,
  initialDisplayName,
  userId,
}: EditProfileButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
    setDisplayName(initialDisplayName ?? "");
  }, [initialAvatarUrl, initialDisplayName]);

  function closeModal() {
    if (isSaving || isUploading) {
      return;
    }

    setErrorMessage(null);
    setIsOpen(false);
    setAvatarUrl(initialAvatarUrl);
    setDisplayName(initialDisplayName ?? "");
  }

  async function handleSave() {
    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setErrorMessage("Add a display name so people know who they're looking at.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const updates = {
        avatar_url: avatarUrl,
        display_name: trimmedDisplayName,
      } satisfies Database["public"]["Tables"]["profiles"]["Update"];

      const profileQuery = supabase.from("profiles");
      const { error } = await profileQuery
        // @ts-expect-error Supabase infers `never` here from the handcrafted Database type.
        .update(updates)
        .eq("id", userId);

      if (error) {
        throw error;
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't save your profile just yet.");
    } finally {
      setIsSaving(false);
    }
  }

  const previewLabel = displayName.trim() || "Traveler";

  return (
    <>
      <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setIsOpen(true)}>
        Edit Profile
      </Button>

      <Modal
        description="Update the name and photo that follow you across every trip."
        isOpen={isOpen}
        onClose={closeModal}
        panelClassName="sm:max-w-2xl"
        title="Edit profile"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isSaving || isUploading} variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button isLoading={isSaving} disabled={isUploading} onClick={() => void handleSave()}>
              Save changes
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-2xl font-semibold text-[#8b5cf6]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={previewLabel} className="h-full w-full object-cover" src={avatarUrl} />
              ) : (
                <span>{getInitials(previewLabel || "Y") || "Y"}</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="gradient-text text-sm font-medium uppercase tracking-wide">Preview</p>
              <p className="mt-1 text-sm leading-6 text-[#d4d4d8]">
                This is how your profile photo and name show up around the app.
              </p>
            </div>
          </div>

          <Input
            label="Display name"
            maxLength={80}
            placeholder="What should people call you?"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
          />

          <ImageUploader
            bucket="avatars"
            initialImageUrl={avatarUrl}
            label="Profile photo"
            pathPrefix={`${userId}/avatar`}
            onChange={(value) => {
              if (value) {
                // Append cache-busting param so mobile/browser caches show the new image
                const separator = value.publicUrl.includes("?") ? "&" : "?";
                setAvatarUrl(`${value.publicUrl}${separator}v=${Date.now()}`);
                setErrorMessage(null);
                // Remove previous avatar files (e.g. avatar.png when new is avatar.jpg)
                void deleteOldAvatarFiles(supabase, userId, value.path);
              }
            }}
            onUploadingChange={setIsUploading}
          />

          {errorMessage ? (
            <div className="rounded-2xl border border-[#ef4444/30] bg-[#450a0a/90] px-4 py-3 text-sm text-[#fca5a5]">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
