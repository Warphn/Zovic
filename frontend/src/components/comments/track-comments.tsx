"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatTime, useComments, type CommentItem } from "@/lib/comments-store"
import type { UserProfile } from "@/lib/user-store"
import { cn } from "@/lib/utils"

export interface TrackCommentsProps {
  track: {
    id: string
    title: string
    artist: string
    durationSec: number
  }
  user: UserProfile
  currentPlaybackSec: number
  onSeek: (seconds: number) => void
}

export function TrackComments({
  track,
  user,
  currentPlaybackSec,
  onSeek,
}: TrackCommentsProps) {
  const { comments, addComment, deleteComment, reportComment } = useComments(
    track.id,
    user.id,
    user.isUnderage,
  )

  const [commentText, setCommentText] = React.useState("")
  const [syncWithAudio, setSyncWithAudio] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Denúncia inline
  const [reportingCommentId, setReportingCommentId] = React.useState<string | null>(null)
  const [reportReason, setReportReason] = React.useState("")
  const [reportSuccessMsg, setReportSuccessMsg] = React.useState<string | null>(null)

  const charCount = commentText.length
  const isOverLimit = charCount > 280

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    try {
      const timestamp = syncWithAudio ? currentPlaybackSec : null
      addComment(commentText, timestamp, user.name)
      setCommentText("")
      setSyncWithAudio(false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg("Erro ao publicar comentário.")
      }
    }
  }

  const handleDelete = (commentId: string) => {
    try {
      deleteComment(commentId)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      }
    }
  }

  const handleOpenReport = (commentId: string) => {
    setReportingCommentId(commentId)
    setReportReason("")
    setReportSuccessMsg(null)
    setErrorMsg(null)
  }

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportingCommentId) return

    try {
      reportComment(reportingCommentId, reportReason)
      setReportSuccessMsg("Denúncia registrada com sucesso. Analisaremos o conteúdo.")
      setReportingCommentId(null)
      setReportReason("")
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message)
      }
    }
  }

  // Se menor de idade, não renderiza absolutamente nada
  if (user.isUnderage) {
    return null
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background/50">
      {/* Sub-header com contexto e contagem */}
      <div className="px-6 py-2.5 border-b border-border/80 flex items-center justify-between bg-surface/40">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
            Comentários
          </Badge>
          <span className="text-xs font-semibold text-foreground truncate max-w-[220px] sm:max-w-md">
            {track.title}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            ({comments.length})
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground hidden sm:inline font-mono">
          Clique no tempo para pular para o trecho
        </span>
      </div>

      {/* Alertas de Erro e Sucesso */}
      {errorMsg && (
        <div className="mx-6 mt-3 bg-destructive/15 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-lg">
          {errorMsg}
        </div>
      )}
      {reportSuccessMsg && (
        <div className="mx-6 mt-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs px-3 py-2 rounded-lg">
          {reportSuccessMsg}
        </div>
      )}

      {/* Formulário de Denúncia Inline */}
      {reportingCommentId && (
        <div className="mx-6 mt-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
              <span>⚠</span> Denunciar comentário
            </span>
            <button
              type="button"
              onClick={() => setReportingCommentId(null)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ✕ Cancelar
            </button>
          </div>
          <form onSubmit={handleSubmitReport} className="space-y-2">
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Descreva o motivo da denúncia (máx 280 caracteres)..."
              maxLength={280}
              required
              rows={2}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-destructive resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">
                {reportReason.length}/280 caracteres
              </span>
              <Button
                type="submit"
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-7 px-3 cursor-pointer"
              >
                Confirmar Denúncia
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Lista rolável de comentários */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2.5 min-h-0">
        {comments.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground font-mono">
            Nenhum comentário ainda nesta faixa. Seja o primeiro a comentar!
          </div>
        ) : (
          comments.map((item: CommentItem) => {
            const isMine = item.userId === user.id
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-border/80 bg-surface/70 space-y-1.5 hover:bg-surface transition-colors shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {item.authorName}
                    </span>
                    {isMine && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        Você
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      • {item.createdAt}
                    </span>
                  </div>

                  {/* Ações: Apagar (autor) ou Denunciar (outros) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMine ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="Apagar meu comentário"
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        🗑 Apagar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenReport(item.id)}
                        title="Denunciar este comentário"
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        ⚑ Denunciar
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {item.comment}
                </p>

                {/* Tag de sincronização com tempo do áudio */}
                {item.timestamp !== null && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => onSeek(item.timestamp!)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:scale-102 transition-all cursor-pointer"
                      title={`Pular para ${formatTime(item.timestamp)} na música`}
                    >
                      <span>▶</span>
                      <span>{formatTime(item.timestamp)}</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Caixa de Comentário (máx 280 caracteres) */}
      <form
        onSubmit={handlePostComment}
        className="px-6 py-3 border-t border-border bg-surface/90 space-y-2 shrink-0"
      >
        <div className="relative">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Escreva seu comentário sobre esta faixa (máx 280 caracteres)..."
            maxLength={280}
            required
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Opção de sincronizar com a posição atual da música */}
          <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
            <input
              type="checkbox"
              checked={syncWithAudio}
              onChange={(e) => setSyncWithAudio(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-mono">
              Sincronizar no tempo atual ({formatTime(currentPlaybackSec)})
            </span>
          </label>

          <div className="flex items-center justify-end gap-3">
            <span
              className={cn(
                "text-[10px] font-mono",
                isOverLimit ? "text-destructive font-bold" : "text-muted-foreground",
              )}
            >
              {charCount}/280
            </span>

            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || isOverLimit}
              className="h-7 text-xs font-semibold px-4 cursor-pointer"
            >
              Comentar
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

