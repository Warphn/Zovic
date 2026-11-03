"use client";

import Link from "next/link";
import HeroPreview from "./hero-preview";
import { scrollToSection } from "./section-link";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export default function Hero() {
  return (
    // Split hero: the promise on the left, the playlist page it describes on the right
    <section className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-12 px-6 pt-24 pb-16 md:grid-cols-[1fr_1.1fr] md:gap-16 md:px-8 md:pt-16 md:pb-0">
      <div>
        <h1 className="text-5xl leading-[1.02] font-medium tracking-[-0.03em] sm:text-6xl lg:text-7xl">
          Ouça agora, guarde do seu jeito
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Busque faixas, artistas e álbuns, toque sem sair da página e monte playlists com capa, cor e ordem que são só suas
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/playlist" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 text-base")}>
            Começar a ouvir
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => scrollToSection("como-funciona")}
            className="h-12 px-6 text-base"
          >
            Ver como funciona
          </Button>
        </div>
      </div>

      <HeroPreview />
    </section>
  );
}
