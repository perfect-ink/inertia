import type { Folder, Task, TaskDependency, TaskLink } from '@/types'
import { brokenNote, crossProjectLinks, externalTasks, linkStubs, linkedFolders, movedElsewhere, movedMessage, placeStubs, rescheduledOf } from './crossProjectLink'
import { drivingPath } from './dependency'

const folder = (id: number, name: string, kind: Folder['kind'], children: Folder[] = []) =>
  ({ id, name, kind, children, documents: [], parent_id: null }) as unknown as Folder
// Messages (1, with the subfolder Design, 2) and Billing (3) are projects; 4 is a plain folder.
const folders = [folder(1, 'Messages', 'project', [folder(2, 'Design', 'folder')]), folder(3, 'Billing', 'project'), folder(4, 'Loose', 'folder')]

const link = (id: number, due_date: string | null, folder_id: number | null, start_date: string | null = null, title = `T${id}`) =>
  ({ id, title, status: 'todo', start_date, due_date, folder_id }) as TaskLink
const dep = (id: number, predecessor: TaskLink, successor: TaskLink, kind: TaskDependency['kind'] = 'finish_to_start'): TaskDependency =>
  ({ id, predecessor_id: predecessor.id, successor_id: successor.id, kind, created_at: '', predecessor, successor })

describe('stubs on the Gantt', () => {
  // Task 1 is on the chart (project Messages).
  const own = link(1, '2026-11-20', 1, '2026-11-10', 'Build')
  const chart = new Map([[1, own]])

  test('a task that waits on another product gets a stub entering its start', () => {
    const vendor = link(8, '2026-11-09', 3, '2026-11-01', 'Vendor contract')
    const [stub] = linkStubs([dep(5, vendor, own)], chart, folders, new Set())
    expect(stub).toMatchObject({ key: '5', row: 'task-1', side: 'start', direction: 'in', name: 'Vendor contract (Billing)', brokenByDays: 0, critical: false })
    expect(stub.detail).toBe('Waits on Vendor contract (Billing) · Finish to start · due Nov 9')
  })

  test('a task another product waits on gets a stub leaving its end', () => {
    const launch = link(9, '2026-11-30', 3, '2026-11-18', 'Launch')
    const [stub] = linkStubs([dep(6, own, launch)], chart, folders, new Set())
    expect(stub).toMatchObject({ row: 'task-1', side: 'end', direction: 'out', name: 'Launch (Billing)', brokenByDays: 2 })
    expect(stub.detail).toBe(`Needed by Launch (Billing) · Finish to start · due Nov 30 · ${brokenNote(2)}`)
  })

  test('the side follows the link type, and a task in no product is named alone', () => {
    const loose = link(8, '2026-11-12', null, null, 'Loose end')
    expect(linkStubs([dep(5, loose, own, 'finish_to_finish')], chart, folders, new Set())[0]).toMatchObject({ side: 'end', direction: 'in', name: 'Loose end' })
    expect(linkStubs([dep(5, own, loose, 'start_to_start')], chart, folders, new Set())[0]).toMatchObject({ side: 'start', direction: 'out' })
  })

  test('a stub is critical when both its tasks are on the driving path', () => {
    const vendor = link(8, '2026-11-12', 3)
    const external = [dep(5, vendor, own)]
    expect(linkStubs(external, chart, folders, new Set([1, 8]))[0].critical).toBe(true)
    expect(linkStubs(external, chart, folders, new Set([1]))[0].critical).toBe(false)
  })

  test('the driving path steps through a task in another product by its dates', () => {
    const vendor = link(8, '2026-11-12', 3, '2026-11-01')
    const tasks = [own, link(2, '2026-11-15', 1, '2026-11-05')]
    const external = [dep(5, vendor, own)]
    expect(drivingPath(tasks, [], [vendor]).size).toBe(0)
    expect([...drivingPath(tasks, external, externalTasks(external, new Set([1, 2])))].sort()).toEqual([1, 8])
  })

  describe('placement', () => {
    const bars = [
      { key: 'task-2', offsetPct: 0, widthPct: 20 },
      { key: 'task-1', offsetPct: 40, widthPct: 30 },
    ]
    const vendor = link(8, '2026-11-12', 3)
    const place = (stubs: ReturnType<typeof linkStubs>) => placeStubs(stubs, bars, 2.25, 1.5)

    test('starts at the bar edge, in its row, with the room left on that side', () => {
      const [entering] = place(linkStubs([dep(5, vendor, own)], chart, folders, new Set()))
      expect(entering).toMatchObject({ leftPct: 40, topRem: 2.25 + 0.75, side: 'start', roomPct: 40, headFirst: true, headRight: true })
      const [leaving] = place(linkStubs([dep(6, own, vendor)], chart, folders, new Set()))
      expect(leaving).toMatchObject({ leftPct: 70, side: 'end', roomPct: 30, headFirst: false, headRight: true })
    })

    test('the arrowhead points at the bar when entering and away from it when leaving, on either side', () => {
      const headRight = (kind: TaskDependency['kind'], leaves: boolean) =>
        place(linkStubs([leaves ? dep(5, own, vendor, kind) : dep(5, vendor, own, kind)], chart, folders, new Set()))[0].headRight
      expect(headRight('finish_to_start', true)).toBe(true)
      expect(headRight('finish_to_start', false)).toBe(true)
      expect(headRight('start_to_start', true)).toBe(false)
      expect(headRight('finish_to_finish', false)).toBe(false)
    })

    test('links on one side of a bar share a stub, named together', () => {
      const other = link(9, '2026-11-14', 2, null, 'Wireframes')
      const [stub, ...rest] = place(linkStubs([dep(5, vendor, own), dep(6, other, own)], chart, folders, new Set()))
      expect(rest).toHaveLength(0)
      expect(stub.key).toBe('5+6')
      expect(stub.label).toBe('Waits on T8 (Billing), Wireframes (Messages)')
      expect(stub.detail.split('\n')).toHaveLength(2)
    })

    test('an entering and a leaving link on the same side are kept apart', () => {
      const stubs = place(linkStubs([dep(5, vendor, own, 'finish_to_finish'), dep(6, own, vendor, 'finish_to_start')], chart, folders, new Set()))
      const [entering, leaving] = stubs
      expect(entering.topRem).toBeLessThan(leaving.topRem)
    })

    test('a stub for a task that has no row is dropped', () => {
      const elsewhere = link(77, '2026-11-20', 1)
      expect(place(linkStubs([dep(5, vendor, elsewhere)], new Map([[77, elsewhere]]), folders, new Set()))).toEqual([])
    })
  })
})

describe('tasks moved in other products', () => {
  const task = (id: number, title: string, due_date: string | null, start_date: string | null, folder_id: number | null) =>
    ({ id, title, due_date, start_date, folder_id, status: 'todo' }) as unknown as Task

  test('reads the rescheduled list of an update response', () => {
    expect(rescheduledOf({ id: 1, rescheduled: [task(2, 'B', null, null, 1)] })).toHaveLength(1)
    expect(rescheduledOf({ id: 1 })).toEqual([])
    expect(rescheduledOf(undefined)).toEqual([])
  })

  test('leaves out tasks on the chart and names the product of the others', () => {
    const moved = movedElsewhere(
      [task(2, 'Build', '2026-11-22', '2026-11-08', 1), task(99, 'Vendor contract', '2026-11-14', '2026-11-10', 3), task(98, 'Loose end', '2026-11-16', null, null)],
      new Set([1, 2]),
      folders,
    )
    expect(moved).toEqual([
      { id: 99, title: 'Vendor contract', project: 'Billing', start_date: '2026-11-10', due_date: '2026-11-14' },
      { id: 98, title: 'Loose end', project: null, start_date: null, due_date: '2026-11-16' },
    ])
  })

  test('places a task that sits in a document through the folder its links carry', () => {
    const inDocument = task(99, 'Vendor contract', '2026-11-14', null, null)
    const links = [dep(1, link(99, '2026-11-14', 3), link(1, '2026-11-20', 1))]
    expect(movedElsewhere([inDocument], new Set(), folders)[0].project).toBeNull()
    expect(movedElsewhere([inDocument], new Set(), folders, linkedFolders(links))[0].project).toBe('Billing')
  })

  test('a task reported twice counts once, as of the last report', () => {
    const moved = movedElsewhere([task(99, 'Vendor contract', '2026-11-14', null, 3), task(99, 'Vendor contract', '2026-11-18', null, 3)], new Set(), folders)
    expect(moved).toHaveLength(1)
    expect(moved[0].due_date).toBe('2026-11-18')
  })

  test('says nothing when nothing moved, else lists each task with its new dates', () => {
    expect(movedMessage([])).toBeNull()
    const moved = movedElsewhere([task(99, 'Vendor contract', '2026-11-14', '2026-11-10', 3), task(98, 'Loose end', '2026-11-16', null, null)], new Set(), folders)
    expect(movedMessage(moved)).toBe('Also moved in other products: Vendor contract (Billing) to Nov 10 - Nov 14; Loose end to Nov 16')
  })
})

describe('the Space-wide list', () => {
  const a = link(1, '2026-11-20', 1, '2026-11-10', 'Build')
  const b = link(2, '2026-11-12', 3, '2026-11-01', 'Vendor contract')
  const c = link(3, '2026-11-30', 3, '2026-11-25', 'Launch')

  test('lists links between products and leaves out those inside one product', () => {
    const inside = link(4, '2026-11-05', 2, null, 'Wireframes') // in Messages' subfolder
    const links = crossProjectLinks([dep(10, b, a), dep(11, inside, a), dep(12, link(5, null, 3), link(6, null, 3))], folders)
    expect(links.map((l) => l.id)).toEqual([10])
    expect(links[0]).toMatchObject({ kind: 'finish_to_start', waiting: { title: 'Build', project: { id: 1, name: 'Messages' } }, waitedOn: { title: 'Vendor contract', project: { id: 3, name: 'Billing' } } })
  })

  test('a task in no product is elsewhere from one in a product; two in none are together', () => {
    const loose = link(7, '2026-11-10', 4, null, 'Loose')
    const none = link(8, '2026-11-10', null, null, 'None')
    expect(crossProjectLinks([dep(1, loose, a), dep(2, none, link(9, null, 4))], folders).map((l) => l.id)).toEqual([1])
  })

  test('broken links come first, the most days first, then by product and title', () => {
    // The vendor finishes on the 12th: a task starting then holds, on the 10th is 2 days out, on the 8th 4.
    const fine = link(10, '2026-11-18', 1, '2026-11-12', 'Fine')
    const tight = link(11, '2026-11-25', 1, '2026-11-08', 'Tight')
    const tighter = link(12, '2026-11-25', 1, '2026-11-10', 'Tighter')
    // Build ends on the 20th and Launch starts on the 25th: holds.
    const links = crossProjectLinks([dep(1, b, fine), dep(2, b, tighter), dep(3, b, tight), dep(4, a, c)], folders)
    expect(links.map((l) => [l.waiting.title, l.brokenByDays])).toEqual([['Tight', 4], ['Tighter', 2], ['Launch', 0], ['Fine', 0]])
  })

  test('skips links the server sent without both tasks, and never flags an undated one', () => {
    const bare = { id: 1, predecessor_id: 1, successor_id: 2, kind: 'finish_to_start', created_at: '' } as TaskDependency
    expect(crossProjectLinks([bare], folders)).toEqual([])
    expect(crossProjectLinks([dep(2, link(1, null, 3), a)], folders)[0].brokenByDays).toBe(0)
  })
})
