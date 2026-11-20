import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// How many recently opened projects are remembered.
const RECENT_LIMIT = 10

interface ProjectStore {
  // The project the sidebar has open; null lists the whole Space. Every list
  // the API returns is narrowed to it (lib/api.ts sends X-Project-Id).
  activeProjectId: number | null
  // Projects opened on this device, most recent first (the primary sidebar's list).
  recentIds: number[]
  setActive: (id: number | null) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      recentIds: [],
      setActive: (id) => set((s) => ({
        activeProjectId: id,
        recentIds: id === null ? s.recentIds : [id, ...s.recentIds.filter((r) => r !== id)].slice(0, RECENT_LIMIT),
      })),
    }),
    { name: 'inertia-project' }
  )
)
