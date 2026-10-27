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

function clampSeconds(seconds: number, duration: number): number {
  return Math.max(0, Math.min(duration, Math.round(seconds)))
}

/* ---------------------------------------------------------------------------
   Seletor de momento: linha do tempo arrastável com as marcas dos comentários
   que já estão ligados a um tempo, ajuste fino em ±1s / ±5s, atalho para o
   tempo atual do player e pré-escuta do trecho escolhido.
   --------------------------------------------------------------------------- */

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-6 px-1.5 rounded-md border border-border bg-background text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
    >
      {label}
    </button>
  )
}

interface CommentTimePickerProps {
  value: number
  duration: number
  playerTime: number
  markers: number[]
  onChange: (seconds: number) => void
  onPreview: (seconds: number) => void
  onClear: () => void
}

function CommentTimePicker({
  value,
  duration,
  playerTime,
  markers,
  onChange,
  onPreview,
  onClear,
}: CommentTimePickerProps) {
  const percent = duration > 0 ? (value / duration) * 100 : 0

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Ajuste fino */}
        <div className="flex items-center gap-1">
          <StepButton label="−5s" onClick={() => onChange(clampSeconds(value - 5, duration))} />
          <StepButton label="−1s" onClick={() => onChange(clampSeconds(value - 1, duration))} />
          <span
            className="min-w-[3.5rem] text-center text-sm font-mono font-bold text-primary tabular-nums"
            aria-live="polite"
          >
            {formatTime(value)}
          </span>
          <StepButton label="+1s" onClick={() => onChange(clampSeconds(value + 1, duration))} />
          <StepButton label="+5s" onClick={() => onChange(clampSeconds(value + 5, duration))} />
        </div>

        {/* Atalhos */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(clampSeconds(playerTime, duration))}
            title="Usar o tempo atual do player"
            className="h-6 px-2 rounded-md border border-border bg-background text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            Tempo do player ({formatTime(playerTime)})
          </button>
          <button
            type="button"
            onClick={() => onPreview(value)}
            title="Levar o player até este momento"
            className="h-6 px-2 rounded-md border border-primary/30 bg-primary/10 text-[10px] font-mono font-bold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
          >
            ▶ Ouvir trecho
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Remover marcação de tempo"
            title="Comentar sem ligar a um momento"
            className="h-6 w-6 rounded-md text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Linha do tempo arrastável */}
      <div className="relative h-6 rounded focus-within:ring-1 focus-within:ring-primary">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-border" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary/60"
          style={{ width: `${percent}%` }}
        />
        {markers.map((sec, idx) => (
          <span
            key={`${sec}-${idx}`}
            className="absolute top-1 bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/40 pointer-events-none"
            style={{ left: `${duration > 0 ? (sec / duration) * 100 : 0}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-background shadow-sm pointer-events-none"
          style={{ left: `${percent}%` }}
        />
        {/* Controle nativo invisível por cima: cuida de arraste, toque e teclado */}
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={value}
          onChange={(e) => onChange(clampSeconds(Number(e.target.value), duration))}
          aria-label="Momento da faixa"
          aria-valuetext={formatTime(value)}
          className="absolute inset-0 m-0 size-full cursor-pointer appearance-none bg-transparent opacity-0 focus:outline-none [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>0:00</span>
        {markers.length > 0 && (
          <span className="hidden sm:inline">Os traços na linha são comentários já ligados a um momento</span>
        )}
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
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
  // null = comentário sem tempo; número = segundos da faixa ligados ao comentário
  const [markedTime, setMarkedTime] = React.useState<number | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Denúncia inline
  const [reportingCommentId, setReportingCommentId] = React.useState<string | null>(null)
  const [reportReason, setReportReason] = React.useState("")
  const [reportSuccessMsg, setReportSuccessMsg] = React.useState<string | null>(null)

  const charCount = commentText.length
  const isOverLimit = charCount > 280

  // Marcas dos comentários que já têm tempo, para exibir na linha do tempo
  const timeMarkers = React.useMemo(
    () => comments.flatMap((c) => (c.timestamp !== null ? [c.timestamp] : [])),
    [comments],
  )

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    try {
      addComment(commentText, markedTime, user.name)
      setCommentText("")
      setMarkedTime(null)
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

        {/* Seletor de momento da faixa (aparece ao marcar um tempo) */}
        {markedTime !== null && (
          <CommentTimePicker
            value={markedTime}
            duration={track.durationSec}
            playerTime={currentPlaybackSec}
            markers={timeMarkers}
            onChange={setMarkedTime}
            onPreview={onSeek}
            onClear={() => setMarkedTime(null)}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {markedTime === null ? (
            <button
              type="button"
              onClick={() => setMarkedTime(clampSeconds(currentPlaybackSec, track.durationSec))}
              className="inline-flex items-center gap-1.5 self-start text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span aria-hidden="true">⏱</span>
              <span>Marcar um momento da faixa</span>
            </button>
          ) : (
            <span className="text-[11px] font-mono text-primary">
              Ligado ao momento {formatTime(markedTime)}
            </span>
          )}

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