import type { CSSProperties } from 'react'
import { TriangleAlert } from 'lucide-react'
import { classNames } from '@/components/ui'
import { brokenNote, type PlacedStub } from '@/data/crossProjectLink'
import './TimelineStubs.scss'

// Links to a task in another project, drawn as a short arrow leaving or
// entering a bar with the other task and its project beside it (the chart has no
// row for that task). Placement is `placeStubs` in data/crossProjectLink.ts.
// The overlay spans the track column, like the arrows between bars; the label
// is the one part that takes the pointer, only so its tooltip can show the
// whole note when the label is cut short.
export function TimelineStubs({ stubs }: { stubs: PlacedStub[] }) {
  if (stubs.length === 0) return null
  return (
    <div className="timeline-stubs">
      {stubs.map((stub) => {
        const head = <span className={classNames('timeline-stub-head', !stub.headRight && 'timeline-stub-head--left')} aria-hidden="true" />
        const line = <span className="timeline-stub-line" aria-hidden="true" />
        return (
          <div
            key={stub.key}
            className={classNames(
              'timeline-stub',
              `timeline-stub--${stub.side}`,
              stub.critical && 'timeline-stub--critical',
              stub.brokenByDays > 0 && 'timeline-stub--broken',
            )}
            style={{ left: `${stub.leftPct}%`, top: `${stub.topRem}rem`, '--stub-room': `${stub.roomPct}%` } as CSSProperties}
          >
            {stub.headFirst ? <>{head}{line}</> : <>{line}{head}</>}
            <span className="timeline-stub-label" title={stub.detail}>
              {stub.brokenByDays > 0 && (
                <span className="timeline-stub-warning" role="img" aria-label={brokenNote(stub.brokenByDays)}>
                  <TriangleAlert className="timeline-stub-warning-icon" aria-hidden="true" />
                </span>
              )}
              {stub.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
