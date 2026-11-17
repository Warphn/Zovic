// The look every action of a track row shares (queue, comments, like, dislike, playlist): a
// 32px circle in the muted text color, with the pointer, and a tinted circle behind the icon on
// hover. Its icon animates on the same hover (see components/icons).
export const TRACK_ACTION_CLASSES =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-default disabled:opacity-40"
