"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database, Profile } from "@/lib/types";
import OnboardingModal from "./OnboardingModal";

type AuthContextValue = {
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  session: Session | null;
  supabase: SupabaseClient<Database>;
  user: User | null;
  isLoading: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile", error);
    return null;
  }

  return data;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const nextProfile = await fetchProfile(supabase, user.id);
    setProfile(nextProfile);
  }, [supabase, user]);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        const nextProfile = await fetchProfile(supabase, currentSession.user.id);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user && typeof window !== "undefined") {
        window.localStorage.removeItem("yonderia-auth-redirect");
      }

      void (async () => {
        if (!nextSession?.user) {
          if (isMounted) {
            setProfile(null);
            setIsLoading(false);
          }
          return;
        }

        const nextProfile = await fetchProfile(supabase, nextSession.user.id);

        if (isMounted) {
          setProfile(nextProfile);
          setIsLoading(false);
        }
      })();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      refreshProfile,
      session,
      supabase,
      user,
      isLoading,
    }),
    [profile, refreshProfile, session, supabase, user, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user && profile && !profile.has_completed_onboarding ? (
        <OnboardingModal
          profile={profile}
          supabase={supabase}
          user={user}
          onCompleted={(nextProfile) => {
            setProfile(nextProfile);
          }}
        />
      ) : null}
    </AuthContext.Provider>
  );
}
