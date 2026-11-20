import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Briefcase, FolderKanban, Loader2, Plus } from 'lucide-react'
import { Button, FormError, Input } from '@/components/ui'
import WorkspaceLayout from '@/components/WorkspaceLayout'
import CreateItem from '@/components/CreateItem'
import ProjectDetails from '@/components/ProjectDetails'
import DocTypeIcon from '@/components/DocTypeIcon'
import ProjectIcon from '@/components/project/ProjectIcon'
import ProjectIconDialog from '@/components/project/ProjectIconDialog'
import type { Folder } from '@/types'
import { useWorkspace } from '@/api/workspace'
import { useArchivedFolders, useCreateFolder, useUpdateFolder } from '@/api/folders'
import { useSelectProject } from '@/hooks/useSelectProject'
import { errorMessage } from '@/util/errorMessage'
import { documentsIn, projectLastModified, projectsOf } from '@/data/folder'
import { usePageTitle } from '@/hooks/usePageTitle'
import './ProjectsScreen.scss'
import { usePaths } from '@/hooks/usePaths'

// The Space's home page (/space): its projects, each with the docs inside it
// (including docs in its subfolders). A project is a folder with kind
// "project", so it also shows in the sidebar tree and opens on the folder
// page, which holds its documents, files, collections, tasks and events.
export default function ProjectsScreen() {
  const paths = usePaths()
  usePageTitle('Projects')
  const { data: workspace, isLoading } = useWorkspace()
  const createFolder = useCreateFolder()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const nameRef = useRef('')
  const [iconFor, setIconFor] = useState<Folder | null>(null)
  const projects = projectsOf(workspace?.folders ?? [])
  const selectProject = useSelectProject()
  const updateFolder = useUpdateFolder()
  const [showArchived, setShowArchived] = useState(false)
  const { data: archived = [] } = useArchivedFolders()
  const archivedProjects = archived.filter((f) => f.kind === 'project')

  function commitAdd() {
    const name = nameRef.current.trim()
    setAdding(false)
    nameRef.current = ''
    if (!name) return
    setError('')
    createFolder.mutate({ name, kind: 'project' }, { onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <WorkspaceLayout>
      <div className="view-projects">
        <div className="projects-header">
          <h1 className="projects-title">Projects</h1>
          {archivedProjects.length > 0 && (
            <Button variant="secondary" aria-pressed={showArchived} onClick={() => setShowArchived((on) => !on)} className="projects-new">
              Archived
            </Button>
          )}
          {projects.length > 0 && (
            <Button variant="secondary" onClick={() => { selectProject(null); navigate('/documents') }} className="projects-new">
              All files
            </Button>
          )}
          {projects.length > 0 && (
            <Button variant="secondary" onClick={() => navigate('/portfolio')} className="projects-new">
              <Briefcase className="projects-icon" aria-hidden="true" />
              Portfolio
            </Button>
          )}
          <Button variant="primary" onClick={() => setAdding(true)} className="projects-new">
            <Plus className="projects-icon" aria-hidden="true" />
            New project
          </Button>
        </div>

        <div className="projects-body">
          <div className="projects-list">
            <FormError message={error} />
            {showArchived && archivedProjects.length > 0 && (
              <ul aria-label="Archived" className="projects-archived">
                {archivedProjects.map((project) => (
                  <li key={project.id} className="projects-archived_row">
                    <ProjectIcon project={project} />
                    <span className="projects-archived_name">{project.name}</span>
                    <Button variant="secondary" onClick={() => updateFolder.mutate({ id: project.id, archived: false })}>Unarchive</Button>
                  </li>
                ))}
              </ul>
            )}
            {adding && (
              <Input
                autoFocus
                aria-label="Project name"
                placeholder="Project name"
                onChange={(e) => { nameRef.current = e.target.value }}
                onBlur={commitAdd}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAdd()
                  if (e.key === 'Escape') { nameRef.current = ''; setAdding(false) }
                }}
              />
            )}

            {isLoading && <Loader2 className="projects-icon projects-icon--spin" aria-label="Loading" />}

            {!isLoading && projects.length === 0 && !adding && (
              <div className="projects-empty">
                <FolderKanban className="projects-empty_icon" aria-hidden="true" />
                <p>No projects yet. A project holds the documents, files, collections, tasks and events for one piece of work.</p>
              </div>
            )}

            {projects.map((project) => {
              const docs = documentsIn(project)
              const modified = projectLastModified(project)
              return (
                <section key={project.id} className="projects-card" aria-labelledby={`project-${project.id}`}>
                  <div className="projects-card-top">
                    <Button onClick={() => setIconFor(project)} aria-label={`Change icon for ${project.name}`} title="Change icon" className="projects-card-icon">
                      <ProjectIcon project={project} size="lg" />
                    </Button>
                    <h2 id={`project-${project.id}`} className="projects-card-title">
                      <Link to={paths.folder(project.id)} className="projects-card-link">{project.name}</Link>
                    </h2>
                    <span className="projects-card-meta">
                      {docs.length} {docs.length === 1 ? 'file' : 'files'}
                      {modified && ` · updated ${format(parseISO(modified), 'MMM d, yyyy')}`}
                    </span>
                  </div>

                  <ProjectDetails project={project} />

                  {docs.length > 0 && (
                    <ul className="projects-docs">
                      {docs.map((doc) => (
                        <li key={doc.id}>
                          <Link to={paths.document(doc)} className="projects-doc">
                            <DocTypeIcon type={doc.doc_type} className="projects-doc-icon" />
                            <span className="projects-doc-title">{doc.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <CreateItem folderId={project.id} />
                </section>
              )
            })}
          </div>
        </div>
        <ProjectIconDialog project={iconFor && (projects.find((p) => p.id === iconFor.id) ?? null)} onClose={() => setIconFor(null)} />
      </div>
    </WorkspaceLayout>
  )
}
