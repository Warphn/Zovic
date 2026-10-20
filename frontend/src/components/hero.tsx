"use client";

import Link from "next/link";
import { scrollToSection } from "./section-link";
import { Button } from "./ui/button";

export default function Hero() {
  return (
    <section className="flex flex-col w-full h-dvh px-6 md:px-16 justify-center items-center">
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-semibold text-center leading-[0.9] mb-5">
          Suas músicas<br />
          do seu jeito
        </h1>
      <p className="text-lg sm:text-xl text-center mb-8">Crie playlists personalizadas e organize suas músicas com facilidade.</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link href="/playlist">
          <Button variant="default" size="lg" className="h-12 px-8 text-base cursor-pointer">
            Criar playlist
          </Button>
        </Link>
        <Button variant="outline" size="lg" onClick={() => scrollToSection("como-funciona")} className="h-12 px-8 text-base cursor-pointer">
          Ver como funciona
        </Button>
      </div>
    </section>
  );
}
