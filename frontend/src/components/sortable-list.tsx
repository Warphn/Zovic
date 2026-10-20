"use client"

import * as React from "react"
import { GridLayout, useContainerWidth } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import { orderFromLayout } from "@/lib/playlist-layout"

interface SortableListProps {
  /** Item ids in display order; each child must use the matching id as its key. */
  ids: string[]
  /** Fixed row height in px: grid rows cannot grow with their content. */
  rowHeight: number
  gap?: number
  disabled?: boolean
  onReorder: (ids: string[]) => void
  className?: string
  children: React.ReactNode
}

// Vertical drag-to-reorder list on top of react-grid-layout (one column, no resize).
// Buttons inside rows stay clickable (a row-wide button marked data-row-action still drags),
// and the click that ends a drag is swallowed so
// dropping a row never triggers the link or button under the pointer.
export function SortableList({
  ids,
  rowHeight,
  gap = 10,
  disabled = false,
  onReorder,
  className,
  children,
}: SortableListProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })
  const draggedRef = React.useRef(false)

  const layout = React.useMemo(
    () => ids.map((i, y) => ({ i, x: 0, y, w: 1, h: 1 })),
    // ids is rebuilt every render; its content is what matters
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [ids.join("|")]
  )

  return (
    <div
      ref={containerRef}
      className={className}
      onClickCapture={(e) => {
        if (!draggedRef.current) return
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {mounted ? (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 1, rowHeight, margin: [0, gap], containerPadding: [0, 0] }}
          dragConfig={{ enabled: !disabled, cancel: "button:not([data-row-action]), input" }}
          resizeConfig={{ enabled: false }}
          onDrag={() => {
            draggedRef.current = true
          }}
          onDragStop={(next) => {
            const order = orderFromLayout(next)
            if (order.join("|") !== ids.join("|")) onReorder(order)
            setTimeout(() => {
              draggedRef.current = false
            }, 0)
          }}
        >
          {children}
        </GridLayout>
      ) : (
        // Static stack until the width is measured (also what the server renders)
        <div className="flex flex-col" style={{ gap }}>
          {React.Children.map(children, (child) => (
            <div style={{ height: rowHeight }}>{child}</div>
          ))}
        </div>
      )}
    </div>
  )
}
