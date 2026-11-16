# "source links to target": which documents a document points at, rebuilt from
# its content every time it is saved, so a document can list the documents that
# link to it (docs/features/document_backlinks.md).
class DocumentLink < ApplicationRecord
  # The address of a document in the app, as a link in the text holds it, by
  # id: "/documents/12", "/documents/12#launch-plan" (a heading link), the hash
  # router's "#/documents/12", or either behind a scheme and host. The path has
  # to start with documents/<id>. Ids keep working when a document is renamed or
  # moved, while hierarchical URLs (folder slugs in the path) put other things in
  # front, so "/product/documents/5" (a document titled "5" in a folder called
  # "documents") is not mistaken for document 5. A hierarchical path is read
  # separately (see LinkAddress) and looked up with PathResolver.
  HREF = %r{\A(?:https?://[^/?#]+)?(?:/\#|\#|)/documents/(\d+)(?:[/?\#]|\z)}

  # The ids a document's content links to, and the hierarchical paths (slug
  # arrays) that still have to be looked up to know which documents they name.
  Targets = Struct.new(:ids, :paths)

  # More distinct paths than a real document links to by pasted address; extras
  # are not looked up, so one save never costs more than this many lookups.
  MAX_PATH_LOOKUPS = 100

  belongs_to :source_document, class_name: "Document"
  belongs_to :target_document, class_name: "Document"

  validates :target_document_id, uniqueness: { scope: :source_document_id }

  # What a TipTap JSON `content` links to: documentLink nodes (the `[[` link,
  # once the editor has it) and ordinary links whose address is a document's
  # id path (including links to a heading in it) count by id; links whose
  # address is a hierarchical path of this app are collected as distinct paths,
  # one per path however many times it is written. Id addresses never become
  # paths, so they cost no lookup.
  def self.targets_in(content, app_hosts: app_host_keys)
    ids = []
    hrefs = []
    walk = lambda do |node|
      next unless node.is_a?(Hash)
      ids << node.dig("attrs", "documentId").to_i if node["type"] == "documentLink" && node.dig("attrs", "documentId")
      Array(node["marks"]).each do |mark|
        hrefs << mark.dig("attrs", "href").to_s if mark.is_a?(Hash) && mark["type"] == "link"
      end
      Array(node["content"]).each(&walk)
    end
    walk.call(content)

    by_id, by_path = hrefs.partition { |href| href.match?(HREF) }
    ids.concat(by_id.map { |href| href[HREF, 1].to_i })
    paths = by_path.filter_map { |href| LinkAddress.slug_path(href, app_hosts: app_hosts) }.uniq.first(MAX_PATH_LOOKUPS)
    Targets.new(ids.uniq.select(&:positive?), paths)
  end

  # The ids of the documents a TipTap JSON `content` links to by id.
  def self.target_ids_in(content) = targets_in(content).ids

  # The hosts a link may be behind to be this app's (config/initializers/app_origins.rb).
  def self.app_host_keys = LinkAddress.host_keys(Rails.configuration.x.app_origins)

  # The ids of the documents (never folders) the paths name in `workspace`,
  # live or by a path the item used to have. One lookup per path, and a path
  # only finds what is in that Space.
  def self.path_target_ids(paths, workspace)
    paths.filter_map do |segments|
      item = PathResolver.find(workspace, segments)
      item.id if item.is_a?(Document)
    end
  end

  # Replaces `document`'s outgoing links to match its content. Only documents
  # in the same Space count, and a document does not link to itself.
  def self.refresh!(document)
    workspace = document.folder.workspace
    targets = targets_in(document.content)
    by_id = targets.ids - [ document.id ]
    by_id = Document.joins(:folder).where(id: by_id, folders: { workspace_id: workspace.id }).pluck(:id) if by_id.any?
    wanted = (by_id + path_target_ids(targets.paths, workspace)).uniq - [ document.id ]
    existing = where(source_document_id: document.id).pluck(:target_document_id)
    return if existing.sort == wanted.sort

    transaction do
      where(source_document_id: document.id, target_document_id: existing - wanted).delete_all
      # insert_all skips a pair another save added meanwhile instead of failing this one.
      rows = (wanted - existing).map { |target_id| { source_document_id: document.id, target_document_id: target_id } }
      insert_all(rows, unique_by: %i[source_document_id target_document_id]) if rows.any?
    end
  end

  # Rebuilds the links of every document, for documents saved before this
  # existed: `DocumentLink.rebuild_all!`.
  def self.rebuild_all!
    Document.where(doc_type: :document).includes(folder: :workspace).find_each { |document| refresh!(document) }
  end
end
