"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export interface PalettePreset {
  mood: string
  color: string
}

export const PRESET_COLORS: PalettePreset[] = [
  { mood: "Editorial / Risografia", color: "#d33a2c" },
  { mood: "Clássico Spotify", color: "#1db954" },
  { mood: "Jazz Noturno", color: "#4f46e5" },
  { mood: "Bossa Nova Dourada", color: "#f59e0b" },
  { mood: "Sintetizadores & Beats", color: "#d946ef" },
  { mood: "Estúdio Minimalista", color: "#334155" },
  { mood: "Lounge & Soul", color: "#991b1b" },
  { mood: "Ambiente & Ecos", color: "#0284c7" },
  { mood: "Eletrônico & Bass", color: "#84cc16" },
  { mood: "Tropicalismo", color: "#ea580c" },
  { mood: "Lo-Fi Instrumental", color: "#7c3aed" },
]

export function getContrastTextColor(hexColor: string): "text-white" | "text-black" {
  const hex = hexColor.replace("#", "")
  if (hex.length !== 6) return "text-white"
  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0
  // Relative luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? "text-black" : "text-white"
}

interface ColorPickerProps {
  color: string
  onChange: (newColor: string) => void
  className?: string
}

export function ColorPicker({ color, onChange, className }: ColorPickerProps) {
  const [draftHex, setDraftHex] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const displayHex = draftHex ?? color

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim()
    if (!val.startsWith("#") && val.length > 0) {
      val = "#" + val
    }
    setDraftHex(val)
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val.toLowerCase())
    }
  }

  const handleBlur = () => {
    setDraftHex(null)
  }

  const handleNativePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDraftHex(null)
    onChange(val.toLowerCase())
  }

  const triggerNativePicker = () => {
    inputRef.current?.click()
  }

  const contrastClass = getContrastTextColor(color)

  return (
    <div className={cn("space-y-3", className)}>
      <Label htmlFor="playlist-color" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
        Cor da Playlist
      </Label>

      {/* Main Color preview and manual Hex controller */}
      <div className="flex items-center gap-3">
        {/* Clickable Color Swatch that opens native OS/browser color picker */}
        <div className="relative group shrink-0">
          <button
            type="button"
            onClick={triggerNativePicker}
            aria-label="Abrir seletor de cor"
            className="size-10 rounded-lg border border-border shadow-xs transition-transform active:scale-95 flex items-center justify-center cursor-pointer overflow-hidden relative"
            style={{ backgroundColor: color }}
          >
            {/* Center icon indicator */}
            <svg
              className={cn("size-4 transition-transform group-hover:scale-110", contrastClass)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
              <path d="m5 2 5 5" />
              <path d="M2 13h10" />
            </svg>
          </button>

          <input
            ref={inputRef}
            id="playlist-color"
            type="color"
            value={color.startsWith("#") && color.length === 7 ? color : "#d33a2c"}
            onChange={handleNativePicker}
            className="sr-only"
            aria-label="Seletor nativo de cor"
            tabIndex={-1}
          />
        </div>

        {/* Hex Input */}
        <div className="relative flex-1">
          <Input
            value={displayHex}
            onChange={handleHexChange}
            onBlur={handleBlur}
            placeholder="#d33a2c"
            maxLength={7}
            aria-label="Código hexadecimal da cor"
            className="font-mono text-xs tracking-widest uppercase pl-3 pr-9 bg-background/80"
          />
          <div
            className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 rounded-full border border-black/20"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={triggerNativePicker}
          className="shrink-0 h-9 px-3 text-xs border-border"
        >
          Personalizar
        </Button>
      </div>

      {/* Preset Swatches Palette */}
      <div className="pt-1">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Cores Curadas
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => {
            const isSelected = color.toLowerCase() === preset.color.toLowerCase()
            return (
              <button
                key={preset.color}
                type="button"
                onClick={() => {
                  setDraftHex(null)
                  onChange(preset.color)
                }}
                title={preset.color}
                aria-label={`Selecionar cor ${preset.color}`}
                aria-pressed={isSelected}
                className={cn(
                  "size-7 rounded-full border border-black/10 shadow-2xs transition-transform cursor-pointer hover:scale-110",
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                style={{ backgroundColor: preset.color }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
