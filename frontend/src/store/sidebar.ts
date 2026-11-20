import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Below the md breakpoint (768px) the sidebars (components/file-manager/Sidebar.tsx)
// become an off-canvas drawer instead of permanent columns, opened from the
// hamburger in WorkspaceLayout's mobile top bar. A tiny store rather than
// local state so the button and the drawer can live in separate components.
interface SidebarStore {
  open: boolean
  toggle: () => void
  close: () => void
  // The primary sidebar (Space, projects, profile) shrinks to a column of
  // icons. Remembered on this device.
  collapsed: boolean
  toggleCollapsed: () => void
  // The project sidebar's Views list (the pages beyond Tasks) is open.
  viewsOpen: boolean
  toggleViews: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      open: false,
      toggle: () => set((s) => ({ open: !s.open })),
      close: () => set({ open: false }),
      collapsed: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      viewsOpen: false,
      toggleViews: () => set((s) => ({ viewsOpen: !s.viewsOpen })),
    }),
    { name: 'inertia-sidebar', partialize: (s) => ({ collapsed: s.collapsed, viewsOpen: s.viewsOpen }) },
  ),
)
