import Link from "next/link";
import { SectionLink } from "./section-link";

export default function Footer() {
  return (
    <footer id="contato" data-header-theme="dark" className="scroll-mt-16 bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <Link href="/" className="text-xl font-medium tracking-[-0.02em]">
            Zovic
          </Link>
          <p className="mt-2 max-w-xs text-sm text-paper/60">
            Streaming de música com busca, fila e playlists que têm a sua cara
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-paper/60">
          <Link href="/playlist" className="transition-colors hover:text-paper">
            Playlists
          </Link>
          <SectionLink section="recursos" className="transition-colors hover:text-paper">
            Recursos
          </SectionLink>
          <SectionLink section="como-funciona" className="transition-colors hover:text-paper">
            Como funciona
          </SectionLink>
          <SectionLink section="planos" className="transition-colors hover:text-paper">
            Planos
          </SectionLink>
        </nav>

        <p className="text-xs font-mono text-paper/40">© Zovic</p>
      </div>
    </footer>
  );
}
