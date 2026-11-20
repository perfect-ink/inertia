import { flattenFolders } from '@/data/folder'
import { quickAddTypesOf } from '@/data/projectFeature'
import { useOpenProject } from '@/hooks/useOpenProject'
import { itemAtPath } from '@/data/path'
import { TransferHost } from '@/components/workspace/TransferDialog'
import { Button, Input, Select, DatePicker, Tab, Tabs, type MenuItem } from '@/components/ui'
import './Sidebar.scss'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSidebarStore } from '@/store/sidebar'
import { useActiveOnboarding, useOnboardingStore } from '@/store/onboarding'
import AppearanceDialog from '@/components/AppearanceDialog'
import { CheckSquare, Loader2, CalendarDays, Keyboard, Download } from 'lucide-react'
import { useWorkspace } from '@/api/workspace'
import { useNewDocument } from '@/hooks/useNewDocument'
import { useCreateTask } from '@/api/tasks'
import { useCreateEvent } from '@/api/events'
import { useEpics } from '@/api/epics'
import { errorMessage } from '@/util/errorMessage'
import { useStartQuipImport, useQuipImport } from '@/api/quipImports'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useTabsStore } from '@/store/tabs'
import { closeTab } from '@/lib/closeTab'
import { ProjectSidebar } from './ProjectSidebar'
import { SpaceSidebar } from './SpaceSidebar'
import { useProjectStore } from '@/store/projects'
import { authApi } from '@/api/auth'
import { todayISO } from '@/util/date'
import { isShortcut, shortcutAvailable, shortcutKey, shortcutLabel, editorKeepsKey, inDocumentEditor } from '@/util/shortcuts'
import { platformKeys } from '@/util/keyLabel'
import { isMac } from '@/util/platform'
import { clashForAction, documentShortcutRows, EDITOR_COMMAND_EVENT } from '@/data/editorShortcut'

import { KEYBOARD_SHORTCUTS } from '@/data/shortcut'
import { styleShortcutRows } from '@/data/paragraphStyleShortcut'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  // What quick add can make: the open project's turned-off Tasks or Events are left out.
  const openProject = useOpenProject()
  const quickAddTypes = quickAddTypesOf(openProject)
  const { data: workspace } = useWorkspace()
  const newDocument = useNewDocument()
  const { user, logout } = useAuthStore()
  const drawerOpen = useSidebarStore((s) => s.open)
  const closeDrawer = useSidebarStore((s) => s.close)
  const createTask = useCreateTask()
  const createEvent = useCreateEvent()
  const { data: epics = [] } = useEpics()
  const [creationError, setCreationError] = useState('')
  const onboardingVisible = useActiveOnboarding(user?.id) !== null
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [quipImportOpen, setQuipImportOpen] = useState(false)
  const [quipToken, setQuipToken] = useState('')
  const [quipDomain, setQuipDomain] = useState('quip.com')
  const [startedQuipImportId, setStartedQuipImportId] = useState<number | null>(null)
  const startQuipImport = useStartQuipImport()
  const { data: quipImport } = useQuipImport(startedQuipImportId)
  const qc = useQueryClient()
  const qcRef = useRef(qc)
  qcRef.current = qc
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddType, setQuickAddType] = useState<'task' | 'event'>('task')
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddDate, setQuickAddDate] = useState('')
  const [quickAddEpicId, setQuickAddEpicId] = useState('')
  const creatingRef = useRef(false)
  const quickAddInputRef = useRef<HTMLInputElement>(null)
  const createNewDocumentRef = useRef(createNewDocument)
  createNewDocumentRef.current = createNewDocument
  const createNewSpreadsheetRef = useRef(createNewSpreadsheet)
  createNewSpreadsheetRef.current = createNewSpreadsheet
  const scopeFolderIdRef = useRef<number | undefined>(undefined)
  const openQuickAddRef = useRef(openQuickAdd)
  openQuickAddRef.current = openQuickAdd
  const shortcutsOpenRef = useRef(shortcutsOpen)
  shortcutsOpenRef.current = shortcutsOpen
  const quickAddOpenRef = useRef(quickAddOpen)
  quickAddOpenRef.current = quickAddOpen
  const quipImportOpenRef = useRef(quipImportOpen)
  quipImportOpenRef.current = quipImportOpen
  const drawerOpenRef = useRef(drawerOpen)
  drawerOpenRef.current = drawerOpen

  // Closes the mobile drawer after navigating anywhere — otherwise it stays
  // open over the page you just picked, which reads as broken on a phone.
  useEffect(() => { closeDrawer() }, [location.pathname])

  useEffect(() => { if (quickAddOpen) quickAddInputRef.current?.focus() }, [quickAddOpen])
  // Refreshes the folder tree once imported content actually exists to
  // show — polling every 1.5s in between would just re-render the same
  // (empty-so-far) tree for no benefit.
  useEffect(() => {
    if (quipImport?.status === 'completed') qc.invalidateQueries({ queryKey: [ 'workspace' ] })
  }, [ quipImport?.status ])

  function openQuickAdd() {
    if (quickAddTypes.length === 0) return
    setQuickAddType(quickAddTypes[0])
    setQuickAddTitle('')
    setQuickAddDate('')
    setQuickAddEpicId('')
    setQuickAddOpen(true)
  }

  function submitQuickAdd() {
    const title = quickAddTitle.trim()
    if (!title) return
    if (quickAddType === 'task') {
      createTask.mutate({ title, dueDate: quickAddDate || undefined, epicId: quickAddEpicId ? Number(quickAddEpicId) : undefined })
    } else {
      createEvent.mutate({ title, date: quickAddDate || todayISO(), event_type: 'deadline' })
    }
    setQuickAddOpen(false)
  }

  // Cmd+N → new document, Cmd+Shift+N → new sheet, Cmd+T → new task, Cmd+E → new event, Cmd+J → new idea, Cmd+W → close
  // tab, Cmd+K → quick-add a task or event without leaving the current page,
  // Cmd+/ (or Cmd+? — Shift+/ on a US layout) → toggle the shortcuts cheat
  // sheet. Keep KEYBOARD_SHORTCUTS (data/shortcut.ts) in sync with this list.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Not gated by metaKey — Escape closes whichever of this rail's own
        // overlays is open, matching the "Esc" row in the shortcuts list.
        if (shortcutsOpenRef.current) setShortcutsOpen(false)
        else if (quickAddOpenRef.current) setQuickAddOpen(false)
        else if (quipImportOpenRef.current) setQuipImportOpen(false)
        else if (drawerOpenRef.current) closeDrawer()
        return
      }
      // In the document editor ⌘K is Insert link, ⌘E inline code and ⌥⌘T Insert table:
      // the formatting wins there (data/editorShortcut.ts, GLOBAL_CLASHES).
      if (editorKeepsKey(e)) return
      if (isShortcut(e, 'n')) {
        e.preventDefault()
        if (e.shiftKey) createNewSpreadsheetRef.current()
        else createNewDocumentRef.current()
      } else if (isShortcut(e, 't')) {
        e.preventDefault()
        const fid = scopeFolderIdRef.current
        navigate(`/tasks?view=backlog&new=1${fid ? `&folder_id=${fid}` : ''}`)
      } else if (isShortcut(e, 'e')) {
        e.preventDefault()
        navigate('/events?new=1')
      } else if (isShortcut(e, 'j')) {
        e.preventDefault()
        navigate('/ideas?new=1')
      } else if (isShortcut(e, 'k')) {
        e.preventDefault()
        openQuickAddRef.current()
      } else if (isShortcut(e, '/')) {
        e.preventDefault()
        setShortcutsOpen((open) => !open)
      } else if ((e.metaKey || e.ctrlKey) && shortcutKey(e) === 'w') {
        // Always prevented, even with no tab open: Electron's default macOS
        // menu binds Cmd+W to closing the whole window (see main.cjs), and
        // that's a native accelerator a renderer preventDefault() can't
        // reach — this only matters for the in-page fallback/web build.
        e.preventDefault()
        const { activeId } = useTabsStore.getState()
        if (!activeId) return
        const next = closeTab(activeId, qcRef.current)
        navigate(next ? next.path : '/space')
      }
    }
    window.addEventListener('keydown', onKey)
    // The Mac app's Format menu owns ⌘K, ⌘E and ⌥⌘T and sends them to the page as editor
    // commands. With no document editor holding the cursor they mean what they do outside
    // a document, so replay the keystroke for the handler above.
    function onFormatCommand(event: Event) {
      const clash = clashForAction(String((event as CustomEvent).detail))
      if (!clash || inDocumentEditor({ target: document.activeElement })) return
      window.dispatchEvent(new KeyboardEvent('keydown', { key: clash.globalKey, metaKey: true, altKey: clash.globalAlt, bubbles: true }))
    }
    window.addEventListener(EDITOR_COMMAND_EVENT, onFormatCommand)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(EDITOR_COMMAND_EVENT, onFormatCommand)
    }
  }, [])

  function handleLogout() {
    authApi.logout().finally(() => {
      logout()
      // "/" is the marketing home on the web and the sign-in page in the native shells (RootRoute in App.tsx).
      navigate('/')
    })
  }

  // The folder the user is "in": the open folder page, or the folder of the
  // open document. Falls back to the workspace root on any other page.
  function scopeFolderId() {
    const item = itemAtPath(workspace?.folders ?? [], location.pathname)
    if (item?.type === 'folder') return item.id
    if (item?.type === 'document') {
      const folder = flattenFolders(workspace?.folders ?? []).find((f) => f.documents?.some((d) => d.id === item.id))
      if (folder) return folder.id
    }
    // Otherwise new things go in the open project.
    return useProjectStore.getState().activeProjectId ?? undefined
  }
  scopeFolderIdRef.current = scopeFolderId()

  async function createAtRoot(type: 'document' | 'spreadsheet' | 'table') {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreationError('')
    try {
      await newDocument(type, scopeFolderId())
    } catch (error) {
      setCreationError(errorMessage(error))
    } finally {
      creatingRef.current = false
    }
  }

  function createNewDocument() { return createAtRoot('document') }
  function createNewSpreadsheet(type: 'spreadsheet' | 'table' = 'spreadsheet') { return createAtRoot(type) }

  const accountItems: MenuItem[] = [
    ...(quickAddTypes.length > 0
      ? [{ key: 'quick-add', label: 'Quick add', hint: platformKeys('⌘K', isMac), onSelect: openQuickAdd }]
      : []),
    { key: 'shortcuts', label: 'Keyboard shortcuts', hint: platformKeys('⌘/', isMac), onSelect: () => setShortcutsOpen(true) },
    { key: 'settings', label: 'Settings', onSelect: () => setAppearanceOpen(true), separatorBefore: true },
    { key: 'quip', label: 'Import from Quip', onSelect: () => setQuipImportOpen(true) },
    ...(user && !onboardingVisible ? [{ key: 'onboarding', label: 'Show getting started', onSelect: () => { useOnboardingStore.getState().reopen(user.id); navigate('/space') } }] : []),
    { key: 'sign-out', label: 'Sign out', onSelect: handleLogout, separatorBefore: true },
  ]

  return (
    <>
      {/* Mobile-only backdrop — tap outside the drawer to close it. */}
      {drawerOpen && (
        <div className="sidebar-backdrop" onClick={closeDrawer} />
      )}
      {/* Two sidebars: the Space and its projects, then the open project's
          tasks, documents and views. Side by side in the drawer on a phone. */}
      <div className={`view-sidebar${drawerOpen ? ' view-sidebar--open' : ''}`}>
        <SpaceSidebar accountItems={accountItems} />
        {openProject && <ProjectSidebar project={openProject} />}
        {creationError && <p role="alert" className="sidebar-error">{creationError}</p>}
      </div>

      {/* Import from Quip */}
      {quipImportOpen && (
        <div className="sidebar-overlay" onClick={() => setQuipImportOpen(false)}>
          <div className="sidebar-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-dialog_title">
              <Download className="sidebar-icon--md sidebar-icon--muted" />
              <h2 className="sidebar-dialog_heading">Import from Quip</h2>
            </div>

            {!startedQuipImportId ? (
              <>
                <p className="sidebar-hint">
                  Walks your Quip account&apos;s Desktop, Starred, and Shared folders and imports every document found,
                  mirroring the folder structure, into your workspace root.
                </p>
                <label className="sidebar-field">
                  Quip API token
                  <Input
                    type="password"
                    autoFocus
                    value={quipToken}
                    onChange={(e) => setQuipToken(e.target.value)}
                    placeholder="Paste your token"
                    className="sidebar-input"
                  />
                </label>
                <label className="sidebar-field">
                  Domain
                  <Select
                    value={quipDomain}
                    onChange={(e) => setQuipDomain(e.target.value)}
                    className="sidebar-input"
                  >
                    <option value="quip.com">quip.com</option>
                    <option value="quip-apple.com">quip-apple.com</option>
                  </Select>
                </label>
                <div className="sidebar-actions">
                  <Button
                    onClick={() => setQuipImportOpen(false)}
                    className="sidebar-cancel"
                  >
                    Cancel
                  </Button>
                  <Button variant="primary"
                    onClick={() => {
                      startQuipImport.mutate(
                        { token: quipToken, domain: quipDomain },
                        { onSuccess: (imp) => setStartedQuipImportId(imp.id) }
                      )
                    }}
                    disabled={!quipToken.trim() || startQuipImport.isPending}
                    className="sidebar-submit"
                  >
                    {startQuipImport.isPending ? 'Starting…' : 'Start import'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="sidebar-import_status">
                  {(quipImport?.status === 'pending' || quipImport?.status === 'running') && (
                    <Loader2 className="sidebar-icon--sm sidebar-icon--muted sidebar-icon--spin" />
                  )}
                  <span className="sidebar-import_state">
                    {quipImport?.status === 'completed' && 'Done'}
                    {quipImport?.status === 'failed' && 'Failed'}
                    {(quipImport?.status === 'pending' || quipImport?.status === 'running' || !quipImport) && 'Importing…'}
                  </span>
                </div>
                <div className="sidebar-import_counts">
                  <span>{quipImport?.folders_created ?? 0} folders created</span>
                  <span>{quipImport?.documents_imported ?? 0} documents imported</span>
                  {!!quipImport?.documents_failed && <span>{quipImport.documents_failed} documents failed</span>}
                </div>
                {quipImport?.status === 'failed' && quipImport.error_message && (
                  <p className="sidebar-import_error">{quipImport.error_message}</p>
                )}
                <div className="sidebar-actions">
                  <Button
                    onClick={() => {
                      setQuipImportOpen(false)
                      setStartedQuipImportId(null)
                      setQuipToken('')
                    }}
                    className="sidebar-cancel"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Move or copy to another Space — opened from the tree's menus */}
      <TransferHost />
      <AppearanceDialog open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div className="sidebar-overlay" onClick={() => setShortcutsOpen(false)}>
          <div className="sidebar-dialog sidebar-dialog--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-dialog_title">
              <Keyboard className="sidebar-icon--md sidebar-icon--muted" />
              <h2 className="sidebar-dialog_heading">Keyboard shortcuts</h2>
            </div>
            <div className="sidebar-shortcuts">
              {KEYBOARD_SHORTCUTS.filter(({ keys }) => shortcutAvailable(keys)).map(({ keys, label }) => (
                <div key={keys} className="sidebar-shortcut">
                  <span>{label}</span>
                  <kbd className="sidebar-kbd">{platformKeys(shortcutLabel(keys), isMac)}</kbd>
                </div>
              ))}
              {/* The editor's own keys (data/editorShortcut.ts); the browser ⌥ rules above don't apply to them. */}
              <h3 className="sidebar-shortcuts_group">In a document</h3>
              {documentShortcutRows(isMac).map(({ keys, label }) => (
                <div key={label} className="sidebar-shortcut">
                  <span>{label}</span>
                  <kbd className="sidebar-kbd">{keys}</kbd>
                </div>
              ))}
              {/* Paragraph styles (data/paragraphStyleShortcut.ts); the headings are listed above. */}
              {styleShortcutRows().filter(({ label }) => !label.startsWith('Heading')).map(({ keys, label }) => (
                <div key={`style-${label}`} className="sidebar-shortcut">
                  <span>{label} style</span>
                  <kbd className="sidebar-kbd">{platformKeys(keys, isMac)}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick add modal */}
      {quickAddOpen && (
        <div className="sidebar-overlay" onClick={() => setQuickAddOpen(false)}>
          <div className="sidebar-dialog" onClick={(e) => e.stopPropagation()}>
            <Tabs label="Add" variant="segmented">
              {quickAddTypes.includes('task') && (
                <Tab active={quickAddType === 'task'} onClick={() => setQuickAddType('task')}>
                  <CheckSquare className="sidebar-icon--sm" />
                  Task
                </Tab>
              )}
              {quickAddTypes.includes('event') && (
                <Tab active={quickAddType === 'event'} onClick={() => setQuickAddType('event')}>
                  <CalendarDays className="sidebar-icon--sm" />
                  Event
                </Tab>
              )}
            </Tabs>

            <Input
              ref={quickAddInputRef}
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              placeholder="Title"
              className="sidebar-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitQuickAdd()
                if (e.key === 'Escape') setQuickAddOpen(false)
              }}
            />

            <label className="sidebar-inline_field">
              {quickAddType === 'task' ? 'Due date' : 'Date'}
              <DatePicker
                value={quickAddDate}
                onChange={(e) => setQuickAddDate(e.target.value)}
                className="sidebar-input sidebar-input--compact"
              />
            </label>

            {quickAddType === 'task' && epics.length > 0 && (
              <label className="sidebar-inline_field">
                Epic
                <Select
                  value={quickAddEpicId}
                  onChange={(e) => setQuickAddEpicId(e.target.value)}
                  className="sidebar-input sidebar-input--compact"
                >
                  <option value="">No epic</option>
                  {epics.map((epic) => (
                    <option key={epic.id} value={epic.id}>{epic.title}</option>
                  ))}
                </Select>
              </label>
            )}

            <div className="sidebar-actions">
              <Button
                onClick={() => setQuickAddOpen(false)}
                className="sidebar-cancel"
              >
                Cancel
              </Button>
              <Button variant="primary"
                onClick={submitQuickAdd}
                disabled={!quickAddTitle.trim() || createTask.isPending || createEvent.isPending}
                className="sidebar-submit"
              >
                Add {quickAddType === 'task' ? 'task' : 'event'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
