'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CallToAction from "@/components/call-to-action";
import Footer from "@/components/footer";
import Header from "@/components/header";
import Features from "@/components/features";
import Hero from "@/components/hero";
import HowItWorks from "@/components/how-it-works";
import Plans from "@/components/plans";
import { useLandingSectionScroll } from "@/components/section-link";
import { useSession } from "@/lib/auth/client";

export default function Home() {
  useLandingSectionScroll();
  const router = useRouter();
  const { data: session } = useSession();

  // The landing is for visitors: a signed-in account goes to its home page. While the session
  // loads, the landing shows as usual, so a visitor never waits for it.
  useEffect(() => {
    if (session) router.replace("/inicio");
  }, [session, router]);

  return (
    <div className="relative min-h-screen bg-background">
      <Header />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Features />
        <HowItWorks />
        <Plans />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
