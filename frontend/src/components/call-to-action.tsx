import Link from "next/link";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

// Last call before the footer: quiet paper, one line and one action
export default function CallToAction() {
  return (
    <section className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-24 md:flex-row md:items-end md:justify-between md:px-8 md:py-32">
        <div className="max-w-2xl">
          <h2 className="text-4xl leading-[1.05] font-medium tracking-[-0.03em] sm:text-6xl">
            A próxima faixa já está na fila
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">Crie sua conta e comece pela música que não sai da sua cabeça</p>
        </div>
        <Link href="/playlist" className={cn(buttonVariants({ size: "lg" }), "h-12 shrink-0 self-start px-6 text-base md:self-auto")}>
          Começar a ouvir
        </Link>
      </div>
    </section>
  );
}
