"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ImageUploader from "@/components/ui/ImageUploader";
import { deleteOldAvatarFiles } from "@/lib/avatars";
import { avatarImageReferrerPolicy } from "@/lib/avatar-image";
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
      <Button className="w-full sm:w-auto" variant="outline" onClick={() => setIsOpen(true)}>
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
            <Button disabled={isSaving || isUploading} variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button isLoading={isSaving} disabled={isUploading} onClick={() => void handleSave()}>
              Save changes
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-2 border-[#121212] bg-[#F8F8F8] p-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-[#121212] bg-[#F0C020] text-2xl font-black text-[#121212]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={previewLabel}
                  className="h-full w-full object-cover"
                  referrerPolicy={avatarImageReferrerPolicy}
                  src={avatarUrl}
                />
              ) : (
                <span>{getInitials(previewLabel || "Y") || "Y"}</span>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-widest text-[#D02020]">Preview</p>
              <p className="mt-1 text-sm font-medium leading-6 text-[#888888]">
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
                const separator = value.publicUrl.includes("?") ? "&" : "?";
                setAvatarUrl(`${value.publicUrl}${separator}v=${Date.now()}`);
                setErrorMessage(null);
                void deleteOldAvatarFiles(supabase, userId, value.path);
              }
            }}
            onUploadingChange={setIsUploading}
          />

          {errorMessage ? (
            <div className="border-2 border-[#D02020] bg-[#D02020]/10 px-4 py-3 text-sm font-medium text-[#D02020]">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
