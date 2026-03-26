import type { Metadata } from "next";
import Link from "next/link";
import PageBackground from "@/components/ui/PageBackground";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportPage() {
  return (
    <main className="page-bg relative min-h-screen px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <PageBackground />
      <div className="relative z-10 mx-auto max-w-3xl">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-[#D02020]">Help</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#121212] sm:text-5xl">
            Support
          </h1>
        </header>

        <section className="mt-8 space-y-6 border-2 sm:border-4 border-[#121212] bg-white p-6 shadow-[6px_6px_0px_0px_black] sm:p-8">
          <div className="space-y-4 text-sm font-medium leading-6 text-[#121212]/80">
            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Get in touch
            </h2>
            <p>
              If you need help with Yonderia, have feedback, or want to report a bug, reach out
              to us:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@yonderia.com"
                  className="font-bold text-[#1040C0] underline"
                >
                  support@yonderia.com
                </a>
              </li>
            </ul>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Account &amp; data
            </h2>
            <p>
              To delete your account and all associated data, visit your profile page and use the
              &ldquo;Delete my account&rdquo; option. For data export requests, email us at the
              address above.
            </p>

            <h2 className="text-lg font-black uppercase tracking-tight text-[#121212]">
              Privacy
            </h2>
            <p>
              Read our{" "}
              <Link href="/privacy" className="font-bold text-[#1040C0] underline">
                privacy policy
              </Link>{" "}
              for details on how your data is handled.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
