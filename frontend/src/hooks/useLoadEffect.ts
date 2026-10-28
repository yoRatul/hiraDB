import { useEffect } from 'react'

export function useLoadEffect(load: () => Promise<void>, refreshKey: number) {
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (active) return load()
      return undefined
    })
    return () => { active = false }
  }, [load, refreshKey])
}
