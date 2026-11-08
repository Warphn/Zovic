/** True on the link's own page and on the pages under it: /playlist/12 belongs to /playlist, /player does not. */
export function isNavLinkActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
