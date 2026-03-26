"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete account");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We couldn't delete your account.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        className="w-full text-[#D02020] hover:bg-[#D02020]/10 sm:w-auto"
        variant="ghost"
        type="button"
        onClick={() => setShowModal(true)}
      >
        Delete my account
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Delete account"
        description="This will permanently delete your account and remove you from all trips. This action cannot be undone."
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="delete-confirm"
              className="block text-sm font-bold text-[#121212]"
            >
              Type <span className="text-[#D02020]">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              className="mt-2 w-full border-2 border-[#121212] px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#D02020]/40"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>
          {errorMessage ? (
            <p className="text-sm font-medium text-[#D02020]">{errorMessage}</p>
          ) : null}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="ghost"
              type="button"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#D02020] text-white hover:bg-[#D02020]/90"
              disabled={confirmText !== "DELETE"}
              isLoading={isDeleting}
              type="button"
              onClick={() => void handleDelete()}
            >
              Delete forever
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
