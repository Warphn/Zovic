"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth/client";
import { useSubscription } from "@/lib/api/subscriptions";
import { planType } from "@/lib/subscription/rules";
import { SiteLink } from "@/components/section-link";
import { Menu } from "@base-ui/react/menu";
import { CloseIcon, ListIcon, LogOutIcon, MenuIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { MainNavBar, MainNavList } from "@/components/main-nav";
import { SearchBar } from "@/components/search/search-bar";

const NAV_LINKS = [
  { label: "Recursos", href: "/#recursos" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Planos", href: "/#planos" },
  { label: "Contato", href: "/#contato" },
];

const HEADER_HEIGHT = 64;

// The sign-in and sign-up pages are where "Entrar" leads, so the header does not offer it there
const AUTH_PATHS = new Set(["/entrar", "/cadastro"]);

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
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const { subscription } = useSubscription();

  if (isPending) return null;
  if (!session) {
    if (AUTH_PATHS.has(pathname)) return null;
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

  // Admins are marked by a small red dot, the same in the pill and in the menu. --color-red, not
  // --primary: on a playlist page --primary follows the playlist accent, and the admin cue should
  // look the same everywhere.
  const isAdmin = session.user.role === "admin";
  const adminDot = <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--color-red)]" />;

  return (
    <div className={className}>
      {/* Base UI Menu: keyboard support, focus handling, outside-click/Escape to close. The
          popup is portaled to <body>, so it keeps the light palette even over dark sections. */}
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Conta de ${session.user.name}${isAdmin ? " (admin)" : ""}`}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface/60 pl-1.5 pr-3.5 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 data-[popup-open]:bg-surface"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground">
            <UserIcon size={14} />
          </span>
          {session.user.name.split(" ")[0]}
          {isAdmin && adminDot}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end" className="z-[60]">
            <Menu.Popup className="min-w-52 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-popover outline-none origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0">
              <div className="px-2.5 py-2">
                <div className="truncate text-sm font-medium">{session.user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{session.user.email}</div>
                {/* One label for what the account is: admin, or the plan (with "conta infantil" for
                    minors, from the API's birthdate check), or no subscription yet */}
                <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {isAdmin && adminDot}
                  {isAdmin
                    ? "Admin"
                    : !subscription
                      ? "Sem assinatura"
                      : `Plano ${planType(subscription.kind).name}${session.user.isAdult ? "" : " · conta infantil"}`}
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              {isAdmin && (
                <Menu.Item
                  onClick={() => {
                    onNavigate?.();
                    router.push("/admin");
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
                >
                  <ShieldIcon size={16} className="text-muted-foreground" />
                  Painel de admin
                </Menu.Item>
              )}
              <Menu.Item
                onClick={() => {
                  onNavigate?.();
                  router.push(subscription ? "/meu-plano" : "/planos");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
              >
                <ListIcon size={16} className="text-muted-foreground" />
                {subscription ? "Meu plano" : "Assinar um plano"}
              </Menu.Item>
              <Menu.Item
                onClick={signOut}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted/40"
              >
                <LogOutIcon size={16} className="text-muted-foreground" />
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
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const { data: session } = useSession();
  const { subscription } = useSubscription();
  // The search reads the catalog, which is only open to subscribers and platform admins
  const canSearch = Boolean(subscription) || session?.user.role === "admin";
  const showSearch = !isLanding && canSearch;
  // Signed out on an auth page the menu would be empty (no links, no search, no "Entrar")
  const hasMenu = isLanding || Boolean(session) || !AUTH_PATHS.has(pathname);
  // The main links open the same catalog as the search. Below 1024 px they live in the menu,
  // so the menu stays up to there; between 768 and 1023 px it holds only them, since the
  // search and the account still fit in the bar.
  const showMainNav = showSearch;
  const menuHiddenFrom = showMainNav ? "lg:hidden" : "md:hidden";

  const menuAnimationClasses = open
    ? "animate-in fade-in fill-mode-forwards"
    : "animate-out fade-out fill-mode-forwards";

  return (
    <>
      {menuMounted && (
        <div
          aria-hidden="true"
          onClick={closeMenu}
          className={`fixed inset-0 z-40 bg-black/50 duration-200 ${menuHiddenFrom} ${menuAnimationClasses}`}
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
            {/* Signed in, the logo leads to the home page (/inicio); signed out, to the landing page,
                since the home page is behind login */}
            <div className="flex items-center gap-6">
              <Link
                href={session ? "/inicio" : "/"}
                className="rounded-sm text-lg font-semibold tracking-tight text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Zovic
              </Link>
              {showMainNav && <MainNavBar className="hidden lg:flex" />}
            </div>

            {/* Centered on the page, not between the logo and the session controls */}
            {showSearch && (
              <SearchBar className="absolute left-1/2 hidden w-full max-w-xs -translate-x-1/2 md:block lg:max-w-md" />
            )}

            {/* The account and the ☰ stay together on the right; between 768 and 1023 px both show */}
            <div className="flex items-center gap-2">
              <nav className="hidden items-center gap-8 md:flex">
                {isLanding &&
                  NAV_LINKS.map((link) => (
                    <SiteLink key={link.href} href={link.href} className={navLinkClasses}>
                      {link.label}
                    </SiteLink>
                  ))}
                {/* A straight divider of its own: a border on the link would follow its rounded focus corners */}
                {isLanding && <span aria-hidden="true" className="h-4 w-px bg-border" />}
                <SessionControls />
              </nav>

              {hasMenu && (
                <button
                  type="button"
                  onClick={toggleMenu}
                  aria-label={open ? "Fechar menu" : "Abrir menu"}
                  aria-expanded={open}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${menuHiddenFrom}`}
                >
                  {open ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
                </button>
              )}
            </div>
          </div>

          {menuMounted && (
            <div className={`px-6 pb-6 pt-2 duration-200 ${menuHiddenFrom} ${menuAnimationClasses} space-y-4`}>
              {showSearch && <SearchBar className="mb-2 md:hidden" />}
              {showMainNav && <MainNavList onNavigate={closeMenu} />}
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
                {/* From 768 px the account sits in the bar */}
                <SessionControls onNavigate={closeMenu} className="py-3 md:hidden" />
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
