import type { Metadata } from "next";
import Link from "next/link";
import PageBackground from "@/components/ui/PageBackground";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm font-medium text-[#888888]">Last updated: March 2026</p>
        </header>

        <section className="mt-8 space-y-6 border-2 sm:border-4 border-[#121212] bg-white p-6 shadow-[6px_6px_0px_0px_black] sm:p-8">
          <div className="space-y-4 text-sm font-medium leading-6 text-[#121212]/80">
            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              What we collect
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account information:</strong> When you sign in with Google or Apple, we
                receive your name, email address, and profile photo. This is used to create and
                display your profile.
              </li>
              <li>
                <strong>Trip data:</strong> Trip names, dates, locations, itinerary items,
                comments, and RSVPs you create or participate in.
              </li>
              <li>
                <strong>Device tokens:</strong> If you enable push notifications, we store your
                device token to deliver notifications. Tokens are deleted when you disable
                notifications or delete your account.
              </li>
            </ul>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              How we use your data
            </h2>
            <p>
              Your data is used solely to provide the Yonderia trip planning service. We do not
              sell, share, or use your data for advertising. We do not use third-party analytics
              or tracking SDKs.
            </p>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Data storage
            </h2>
            <p>
              Data is stored securely on Supabase (hosted on AWS). All connections use HTTPS.
              Row-level security policies ensure you can only access data for trips you
              participate in.
            </p>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Data deletion
            </h2>
            <p>
              You can delete your account at any time from your{" "}
              <Link href="/dashboard" className="font-bold text-[#1040C0] underline">
                profile page
              </Link>
              . This permanently removes your profile, trip participations, comments, reactions,
              and device tokens. Account deletion is irreversible.
            </p>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Third-party services
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Google OAuth:</strong> For authentication only. We do not access your
                Google contacts, calendar, or other data.
              </li>
              <li>
                <strong>Apple Sign In:</strong> For authentication only (iOS).
              </li>
              <li>
                <strong>Firebase Cloud Messaging:</strong> For delivering push notifications.
                Google&rsquo;s privacy policy applies to FCM infrastructure.
              </li>
              <li>
                <strong>Google Maps:</strong> For displaying trip locations. Subject to
                Google&rsquo;s privacy policy.
              </li>
            </ul>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Contact
            </h2>
            <p>
              For privacy questions or data requests, email us at{" "}
              <a href="mailto:support@yonderia.com" className="font-bold text-[#1040C0] underline">
                support@yonderia.com
              </a>{" "}
              or visit our{" "}
              <Link href="/support" className="font-bold text-[#1040C0] underline">
                support page
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
