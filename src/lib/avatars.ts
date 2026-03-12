import type { SupabaseClient } from "@supabase/supabase-js";

const AVATARS_BUCKET = "avatars";

/**
 * Deletes old avatar files for a user, keeping only the file at `keepPath`.
 * Use after uploading a new avatar so we don't leave orphaned files (e.g. avatar.jpg vs avatar.png).
 */
export async function deleteOldAvatarFiles(
  supabase: SupabaseClient,
  userId: string,
  keepPath: string,
): Promise<void> {
  const { data: files } = await supabase.storage.from(AVATARS_BUCKET).list(userId);

  if (!files?.length) {
    return;
  }

  const toRemove = files
    .filter((f) => f.name?.startsWith("avatar."))
    .map((f) => `${userId}/${f.name}`)
    .filter((path) => path !== keepPath);

  if (toRemove.length > 0) {
    await supabase.storage.from(AVATARS_BUCKET).remove(toRemove);
  }
}
