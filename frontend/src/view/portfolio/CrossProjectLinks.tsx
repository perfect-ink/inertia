import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { TriangleAlert } from 'lucide-react'
import { useTaskDependencies } from '@/api/taskDependencies'
import { useWorkspace } from '@/api/workspace'
import { brokenNote, crossProjectLinks, type LinkEnd } from '@/data/crossProjectLink'
import { DEPENDENCY_LABEL } from '@/data/dependency'
import { usePaths } from '@/hooks/usePaths'

function ProjectName({ project }: { project: LinkEnd['project'] }) {
  const paths = usePaths()
  if (!project) return <span className="portfolio-link-muted">(no product)</span>
  return <>(<Link to={`${paths.folder(project.id)}?view=overview`}>{project.name}</Link>)</>
}

function LinkTask({ end }: { end: LinkEnd }) {
  return (
    <>
      <strong>{end.title}</strong> <ProjectName project={end.project} />
    </>
  )
}

// Every link in the Space between tasks in different projects, the ones whose
// dates break the link first. Links are made in a project's Gantt tab; nothing
// is changed here. Shown only when there is a link to show.
export function CrossProjectLinks() {
  const { data: dependencies = [] } = useTaskDependencies()
  const { data: workspace } = useWorkspace()
  const links = crossProjectLinks(dependencies, workspace?.folders ?? [])
  if (links.length === 0) return null
  const broken = links.filter((link) => link.brokenByDays > 0).length

  return (
    <section className="portfolio-links" aria-labelledby="portfolio-links-heading">
      <h2 id="portfolio-links-heading" className="portfolio-links-heading">Links between products</h2>
      <p className="portfolio-link-muted">
        {links.length} {links.length === 1 ? 'link' : 'links'}
        {broken > 0 && `, ${broken} with dates that break the link`}
        . Open a product&apos;s Gantt to change them.
      </p>
      <ul className="portfolio-links-list">
        {links.map((link) => (
          <li key={link.id} className="portfolio-link">
            <span className="portfolio-link-text">
              <LinkTask end={link.waiting} /> waits on <LinkTask end={link.waitedOn} />
            </span>
            <span className="portfolio-link-muted">
              {DEPENDENCY_LABEL[link.kind]}
              {link.waitedOn.due_date && ` · ${link.waitedOn.title} due ${format(parseISO(link.waitedOn.due_date), 'MMM d')}`}
            </span>
            {link.brokenByDays > 0 && (
              <span className="portfolio-link-warning">
                <TriangleAlert className="portfolio-link-icon" aria-hidden="true" />
                {brokenNote(link.brokenByDays)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
