'use client'

import CallToAction from "@/components/call-to-action";
import Footer from "@/components/footer";
import Header from "@/components/header";
import Hero from "@/components/hero";
import HowItWorks from "@/components/how-it-works";
import { useLandingSectionScroll } from "@/components/section-link";
import SilkBackground from "@/components/silk-background";

export default function Home() {
  useLandingSectionScroll();

  return (
    <div className="relative min-h-screen">
      <SilkBackground />
      <Header />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
