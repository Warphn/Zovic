"use client"

import * as React from "react"
import { ApiError } from "./api"

export interface Resource<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

// Loads `load()` on mount and whenever `deps` change; reload() fetches again (after a mutation).
// A response that arrives after a newer request started is dropped.
export function useResource<T>(load: () => Promise<T>, deps: React.DependencyList): Resource<T> {
  const [data, setData] = React.useState<T | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [version, setVersion] = React.useState(0)
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = React.useCallback(load, deps)

  React.useEffect(() => {
    let current = true
    setLoading(true)
    stableLoad()
      .then((value) => {
        if (!current) return
        setData(value)
        setError(null)
      })
      .catch((err: unknown) => {
        if (current) setError(err instanceof ApiError ? err.message : "Algo deu errado. Tente de novo.")
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [stableLoad, version])

  const reload = React.useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading, reload }
}
