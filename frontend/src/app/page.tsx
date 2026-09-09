'use client'

import Header from "@/components/header";
import Hero from "@/components/hero";
import Silk from "@/components/silk"

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <Silk
          speed={5}
          scale={0.7}
          color="#c9bfa9"
          noiseIntensity={2}
          rotation={30}
          lightMode
          shadowOpacity={0.5}
        />
      </div>
      <Header />
      <main className="flex min-h-screen flex-1">
        <Hero />
      </main>
    </div>
  );
}
