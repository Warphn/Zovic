"use client"

import * as React from "react"
import { ConfirmDialog } from "@/app/admin/conteudo/confirm-dialog"
import { Loading, Notice, Section } from "@/components/admin/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type ReportedComment, useCommentReports, useRemoveComment } from "@/lib/api/admin"
import { apiErrorMessage } from "@/lib/api/client"
import { formatTime } from "@/lib/comments-store"
import { formatDateTime } from "@/lib/format-date-time"

// Moderação de comentários (HU-23 e HU-39): os comentários denunciados, dos mais denunciados para os
// menos, com os motivos. Remover é soft delete, e a API guarda o admin que removeu.
export default function AdminReportsPage() {
  const reports = useCommentReports()
  const removeComment = useRemoveComment()
  const [removing, setRemoving] = React.useState<ReportedComment | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  return (
    <Section
      title="Denúncias"
      description="Comentários denunciados, dos mais denunciados para os menos. Remover tira o comentário da música para todos."
    >
      <div className="space-y-4">
        {notice && <Notice tone="info">{notice}</Notice>}
        {reports.isError && <Notice>{apiErrorMessage(reports.error)}</Notice>}
        {reports.isPending ? (
          <Loading />
        ) : reports.data && reports.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário denunciado.</p>
        ) : (
          <ul className="space-y-3">
            {reports.data?.map((item) => (
              <li key={item.id} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{item.author.name}</span> em{" "}
                      <span className="font-semibold text-foreground">{item.music.name}</span>
                      {item.timestamp !== null && <span className="font-mono"> · {formatTime(item.timestamp)}</span>}
                      <span> · {formatDateTime(item.createdAt)}</span>
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.comment}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="destructive" className="text-[10px]">
                      {item.reportCount === 1 ? "1 denúncia" : `${item.reportCount} denúncias`}
                    </Badge>
                    <Button variant="destructive" onClick={() => setRemoving(item)}>
                      Remover
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-3">
                  {item.reports.map((report) => (
                    <li key={`${report.reporterName}-${report.createdAt}`} className="text-xs text-muted-foreground">
                      <span className="text-foreground">“{report.reason}”</span> · {report.reporterName} ·{" "}
                      {formatDateTime(report.createdAt)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Remover comentário"
        description={
          removing
            ? `O comentário de ${removing.author.name} em ${removing.music.name} some para todos. O registro fica no banco, com a data e o admin que removeu.`
            : ""
        }
        confirmLabel="Remover comentário"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          await removeComment.mutateAsync(removing.id)
          setNotice(`Comentário de ${removing.author.name} removido.`)
        }}
      />
    </Section>
  )
}
