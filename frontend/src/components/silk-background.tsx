"use client"

import Silk from "@/components/silk"

// Animated silk backdrop shared by the landing hero and the auth pages. It sits behind
// the page (fixed, -z-10), so the page root must not paint its own background over it.
export default function SilkBackground() {
  return (
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
  )
}
