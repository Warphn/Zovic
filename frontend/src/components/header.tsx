"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth/client";
import { SiteLink } from "@/components/section-link";
import { Menu } from "@base-ui/react/menu";
import { CloseIcon, LogOutIcon, MenuIcon, UserIcon } from "@/components/icons";
import { SearchBar } from "@/components/search/search-bar";
import { Badge } from "@/components/ui/badge";

const NAV_LINKS = [
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Contato", href: "/#contato" },
];

const HEADER_HEIGHT = 64;

// True while a section marked data-header-theme="dark" sits under the header, so the header
// can switch to light text there.
function useHeaderOverDarkSection() {
  const [overDark, setOverDark] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const probe = HEADER_HEIGHT / 2;
      const sections = document.querySelectorAll<HTMLElement>('[data-header-theme="dark"]');
      setOverDark(
        Array.from(sections).some((section) => {
          const rect = section.getBoundingClientRect();
          return rect.top <= probe && rect.bottom >= probe;
        })
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return overDark;
}

const navLinkClasses =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

// "Entrar" for visitors; an account pill (user icon + first name) for signed-in users, whose
// menu holds "Sair". Nothing while the session is still resolving, so the header does not
// flash the wrong state.
function SessionControls({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) {
    return (
      <Link href="/entrar" onClick={onNavigate} className={`${navLinkClasses} text-foreground ${className ?? ""}`}>
        Entrar
      </Link>
    );
  }

  const signOut = async () => {
    // If the API could not end the session, stay put: the account pill shows it is still open
    const { error } = await authClient.signOut();
    if (error) return;
    onNavigate?.();
    router.push("/");
  };

  return (
    <div className={className}>
      {/* Base UI Menu: keyboard support, focus handling, outside-click/Escape to close. The
          popup is portaled to <body>, so it keeps the light palette even over dark sections. */}
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Conta de ${session.user.name}`}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface/60 pl-2.5 pr-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface data-[popup-open]:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground/10">
            <UserIcon size={14} />
          </span>
          {session.user.name.split(" ")[0]}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end" className="z-[60]">
            <Menu.Popup className="min-w-52 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-xl outline-none origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
              <div className="px-2.5 py-2">
                <div className="truncate text-sm font-semibold">{session.user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
                {/* What the account can access: platform role and age group, as the API reports them */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={session.user.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                    {session.user.role === "admin" ? "Admin" : "Assinante"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {session.user.isAdult ? "Maior de idade" : "Menor de idade"}
                  </Badge>
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              <Menu.Item
                onClick={signOut}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
              >
                <LogOutIcon size={16} />
                Sair
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
    } else {
      setMenuMounted(true);
      setOpen(true);
    }
  };

  const closeMenu = () => setOpen(false);
  const overDark = useHeaderOverDarkSection();
  // The landing page shows its section links; every other page shows the search instead.
  // Search is for signed-in users: the catalog it searches is behind login.
  const isLanding = usePathname() === "/";
  const { data: session } = useSession();
  const showSearch = !isLanding && Boolean(session);

  const menuAnimationClasses = open
    ? "animate-in fade-in fill-mode-forwards"
    : "animate-out fade-out fill-mode-forwards";

  return (
    <>
      {menuMounted && (
        <div
          aria-hidden="true"
          onClick={closeMenu}
          className={`fixed inset-0 z-40 bg-black/50 duration-200 md:hidden ${menuAnimationClasses}`}
        />
      )}

      {/* Over a dark section the header's color tokens flip to the light palette, so every
          text-foreground / text-muted-foreground inside it (and the glass) follows. */}
      <header
        data-over-dark={overDark || undefined}
        className="fixed inset-x-0 top-0 z-50 transition-colors duration-300 data-[over-dark]:[--background:#171512] data-[over-dark]:[--foreground:#efe7d8] data-[over-dark]:[--muted-foreground:rgb(239_231_216/0.7)] data-[over-dark]:[--border:rgb(239_231_216/0.2)]"
      >
        {menuMounted && (
          <div
            aria-hidden="true"
            onAnimationEnd={() => {
              if (!open) setMenuMounted(false);
            }}
            className={`absolute inset-0 bg-background glass duration-200 ${menuAnimationClasses}`}
          />
        )}

        <div className={`relative z-10 ${menuMounted ? "" : "glass"}`}>
          <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6 md:px-8">
            <Link
              href="/"
              className="rounded-sm text-lg font-semibold tracking-tight text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Zovic
            </Link>

            {/* Centered on the page, not between the logo and the session controls */}
            {showSearch && (
              <SearchBar className="absolute left-1/2 hidden w-full max-w-xs -translate-x-1/2 md:block lg:max-w-md" />
            )}

            <nav className="hidden items-center gap-8 md:flex">
              {isLanding &&
                NAV_LINKS.map((link) => (
                  <SiteLink key={link.href} href={link.href} className={navLinkClasses}>
                    {link.label}
                  </SiteLink>
                ))}
              <SessionControls className={isLanding ? "border-l border-border pl-8" : undefined} />
            </nav>

            <button
              type="button"
              onClick={toggleMenu}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:hidden"
            >
              {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          </div>

          {menuMounted && (
            <div className={`px-6 pb-6 pt-2 duration-200 md:hidden ${menuAnimationClasses}`}>
              {showSearch && <SearchBar className="mb-2" />}
              <nav className="flex flex-col">
                {isLanding &&
                  NAV_LINKS.map((link) => (
                    <SiteLink
                      key={link.href}
                      href={link.href}
                      onClick={closeMenu}
                      className="py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </SiteLink>
                  ))}
                <SessionControls onNavigate={closeMenu} className="py-3" />
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
