import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { TimelineStubs } from './TimelineStubs'
import type { PlacedStub } from '@/data/crossProjectLink'

const stub = (extra: Partial<PlacedStub> = {}): PlacedStub => ({
  key: '5', leftPct: 40, topRem: 3, side: 'end', direction: 'out', headRight: true, headFirst: false, roomPct: 60,
  label: 'Needed by Launch (Billing)', detail: 'Needed by Launch (Billing) · Finish to start · due Nov 30', brokenByDays: 0, critical: false, ...extra,
})

test('draws nothing without stubs', () => {
  const { container } = render(<TimelineStubs stubs={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('a stub is named with the other task and its product, placed at the bar edge, with the whole note as its tooltip', () => {
  const { container } = render(<TimelineStubs stubs={[stub()]} />)
  const label = screen.getByText('Needed by Launch (Billing)')
  expect(label).toHaveAttribute('title', 'Needed by Launch (Billing) · Finish to start · due Nov 30')
  const root = container.querySelector('.timeline-stub') as HTMLElement
  expect(root).toHaveClass('timeline-stub--end')
  expect(root.style.left).toBe('40%')
  expect(root.style.top).toBe('3rem')
  expect(root.style.getPropertyValue('--stub-room')).toBe('60%')
  expect(root.querySelector('.timeline-stub-head--left')).toBeNull()
})

test('an entering stub puts the arrowhead against the bar, and one that points left is flagged', () => {
  const { container } = render(<TimelineStubs stubs={[stub({ side: 'start', direction: 'in', headFirst: true, headRight: true })]} />)
  expect(container.querySelector('.timeline-stub')?.firstElementChild).toHaveClass('timeline-stub-head')
  const left = render(<TimelineStubs stubs={[stub({ headRight: false })]} />)
  expect(left.container.querySelector('.timeline-stub-head--left')).toBeInTheDocument()
  expect(left.container.querySelector('.timeline-stub')?.firstElementChild).toHaveClass('timeline-stub-line')
})

test('a link whose dates break is marked in words as well as red, and the critical path outlines the stub', () => {
  const { container } = render(<TimelineStubs stubs={[stub({ brokenByDays: 2, critical: true })]} />)
  expect(screen.getByRole('img', { name: 'Dates break this link by 2 days' })).toBeInTheDocument()
  expect(container.querySelector('.timeline-stub')).toHaveClass('timeline-stub--broken', 'timeline-stub--critical')
})
