import Link from "next/link";
import { Button } from "./ui/button";

export default function CallToAction() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 md:px-8 md:py-32">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-primary-foreground sm:px-16 sm:py-24">
          {/* Vinyl grooves peeking from the corner */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full opacity-25"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle, transparent 0px, transparent 6px, rgba(0,0,0,0.6) 7px, transparent 8px)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />

          <div className="relative z-10 max-w-xl">
            <h2 className="mb-5 text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Comece a sua primeira coleção.
            </h2>
            <p className="mb-10 text-lg font-light text-primary-foreground/85">
              Monte uma playlist com a sua cara agora mesmo. É grátis.
            </p>
            <Link href="/playlist">
              <Button
                size="lg"
                className="h-12 cursor-pointer bg-surface px-8 text-base text-ink hover:bg-paper"
              >
                Criar playlist
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
