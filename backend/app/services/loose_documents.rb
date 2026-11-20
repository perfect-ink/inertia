# Moves every document that isn't in a project ("product" in the UI) into its
# Space's Personal Product, which it creates when the Space has none (Alex,
# 2026-11-20: every document belongs to a product). A plain top-level folder
# holding loose documents moves there whole, keeping its structure, unless a
# project sits inside it; then only its loose documents move. Run once by the
# MoveLooseDocumentsIntoProjects migration; safe to run again.
class LooseDocuments
  # The project new documents go to when none is open (frontend data/project.ts).
  PERSONAL_NAMES = [ "Personal Product", "Personal Project" ].freeze

  def self.adopt_all!(log: Rails.logger)
    Workspace.find_each { |workspace| new(workspace, log: log).adopt! }
  end

  def initialize(workspace, log: Rails.logger)
    @workspace = workspace
    @log = log
  end

  # Returns how many documents were moved.
  def adopt!
    root = @workspace.root_folder_id && Folder.find_by(id: @workspace.root_folder_id)
    return 0 unless root

    loose = loose_documents
    return 0 if loose.empty?

    personal = personal_project(root)
    moved = 0
    root.children.reject(&:project?).each do |folder|
      ids = folder.self_and_descendant_ids
      next unless loose.any? { |doc| ids.include?(doc.folder_id) }
      next if Folder.where(id: ids, kind: :project).exists?

      moved += loose.count { |doc| ids.include?(doc.folder_id) } if attempt("folder #{folder.id}") { folder.update!(parent: personal) }
    end
    loose_documents.each do |doc|
      moved += 1 if attempt("document #{doc.id}") { doc.update!(folder: personal) }
    end
    @log.info("LooseDocuments: moved #{moved} document(s) into #{personal.name} in Space #{@workspace.id}")
    moved
  end

  private

  def loose_documents
    folders = Folder.where(workspace_id: @workspace.id).index_by(&:id)
    Document.where(folder_id: folders.keys).to_a.reject { |doc| folders[doc.folder_id].project }
  end

  def personal_project(root)
    Folder.where(workspace_id: @workspace.id, kind: :project, archived_at: nil, name: PERSONAL_NAMES).order(:id).first ||
      Folder.create!(workspace: @workspace, parent: root, name: PERSONAL_NAMES.first, kind: :project)
  end

  # A record that won't save is logged and left where it is.
  def attempt(what)
    yield
    true
  rescue ActiveRecord::ActiveRecordError => e
    @log.warn("LooseDocuments: could not move #{what} in Space #{@workspace.id}: #{e.message}")
    false
  end
end
