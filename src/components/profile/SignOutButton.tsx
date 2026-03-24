"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We couldn't sign you out.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
      <Button
        className="w-full text-[#D02020] hover:bg-[#D02020]/10 sm:w-auto"
        isLoading={isSigningOut}
        variant="ghost"
        type="button"
        onClick={() => void handleSignOut()}
      >
        Sign out
      </Button>
      {errorMessage ? <p className="text-center text-sm font-medium text-[#D02020]">{errorMessage}</p> : null}
    </div>
  );
}
