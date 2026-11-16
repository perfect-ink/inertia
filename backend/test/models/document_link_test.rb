require "test_helper"
require "minitest/mock"

class DocumentLinkTest < ActiveSupport::TestCase
  setup do
    @user = User.create!(name: "Pat", email: "pat-links@example.com", password: "password123")
    @folder = @user.workspace.folders.create!(name: "Docs", kind: :project)
    @a = Document.create!(title: "A", folder: @folder, created_by: @user)
    @b = Document.create!(title: "B", folder: @folder, created_by: @user)
    @c = Document.create!(title: "C", folder: @folder, created_by: @user)
  end

  def doc_with(*nodes) = { "type" => "doc", "content" => nodes }
  def paragraph(*inline) = { "type" => "paragraph", "content" => inline }
  def document_link(id) = { "type" => "documentLink", "attrs" => { "documentId" => id } }
  def link_text(href) = { "type" => "text", "text" => "x", "marks" => [ { "type" => "link", "attrs" => { "href" => href } } ] }

  test "finds document link nodes and links to /documents/<id>, nested anywhere" do
    content = doc_with(
      paragraph(document_link(7)),
      { "type" => "bulletList", "content" => [ { "type" => "listItem", "content" => [ paragraph(link_text("https://x.test/documents/9?a=1"), link_text("/documents/7")) ] } ] },
      paragraph(link_text("https://example.com/other"), link_text("https://x.test/documents/abc"))
    )
    assert_equal [ 7, 9 ], DocumentLink.target_ids_in(content).sort
  end

  test "a link to a heading, and the hash router's form of an address, point at the document" do
    content = doc_with(paragraph(
      link_text("/documents/4#launch-plan"), link_text("#/documents/5"), link_text("#/documents/6#risks"),
      link_text("/documents/8abc"), link_text("/folders/9")
    ))
    assert_equal [ 4, 5, 6 ], DocumentLink.target_ids_in(content).sort
  end

  test "only an address that starts with documents/<id> counts, so folder slugs in a path are not read as an id" do
    content = doc_with(paragraph(
      link_text("/#/documents/3"), link_text("https://x.test/#/documents/2"), link_text("https://x.test:3000/documents/1"),
      link_text("/product/documents/5"), link_text("https://x.test/product/feature-folders/documents/6"), link_text("documents/7")
    ))
    assert_equal [ 1, 2, 3 ], DocumentLink.target_ids_in(content).sort
  end

  test "a link written as a hierarchical path is a path to look up, not an id" do
    content = doc_with(paragraph(
      link_text("/docs/b"), link_text("/Docs/B/#intro"), link_text("#/docs/b"), link_text("/docs/c?x=1"),
      link_text("/documents/4"), link_text("#/documents/5#risks"), link_text("https://example.com/docs/b"), link_text("/tasks")
    ))
    targets = DocumentLink.targets_in(content)
    assert_equal [ 4, 5 ], targets.ids.sort
    assert_equal [ %w[docs b], %w[docs c] ], targets.paths
  end

  test "a path behind the app's own host is read, behind another host it is not" do
    app_host = DocumentLink.app_host_keys.first
    own = LinkAddress.host_keys([ "https://#{app_host}" ])
    content = doc_with(paragraph(link_text("https://#{app_host}/docs/b"), link_text("https://elsewhere.test/docs/c")))
    assert_equal [ %w[docs b] ], DocumentLink.targets_in(content, app_hosts: own).paths
  end

  test "a link to a document by its slug path is recorded, with a heading, a query and the hash router's form too" do
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"), link_text("#/docs/c#intro"))))
    assert_equal [ @b.id, @c.id ].sort, @a.outgoing_links.pluck(:target_document_id).sort
    assert_equal [ "A" ], @b.backlinks.map(&:title)
    assert_equal [ "A" ], @c.backlinks.map(&:title)

    @a.update!(content: doc_with(paragraph(link_text("/Docs/B/?tab=2#intro"))))
    assert_equal [ @b.id ], @a.reload.outgoing_links.pluck(:target_document_id)
  end

  test "a slug path behind the app's host is recorded, behind another site's it is not" do
    app_origin = Rails.configuration.x.app_origins.first.chomp("/")
    @a.update!(content: doc_with(paragraph(link_text("#{app_origin}/docs/b"), link_text("https://elsewhere.test/docs/c"))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "an old path that was redirected still counts, and the backlink survives the rename without a save" do
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"))))
    @b.update!(title: "Renamed")
    assert_equal "renamed", @b.reload.slug
    assert_equal [ "A" ], @b.backlinks.map(&:title)

    @c.update!(content: doc_with(paragraph(link_text("/docs/b"))))
    assert_equal [ @b.id ], @c.outgoing_links.pluck(:target_document_id)
    @a.update!(title: "A again")
    assert_equal [ "A again", "C" ], @b.backlinks.map(&:title)
  end

  test "an old path of a document that moved folders counts too" do
    @b.update!(folder: @user.workspace.folders.create!(name: "Archive"))
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"), link_text("/archive/b"))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "a path that names a folder, nothing, or a folder's inside that is missing adds no backlink" do
    @a.update!(content: doc_with(paragraph(link_text("/docs"), link_text("/docs/missing"), link_text("/nowhere/b"), link_text("/docs/b/deeper"))))
    assert_empty @a.outgoing_links
  end

  test "a path in another Space finds nothing, even for a Space the same person belongs to" do
    other = User.create!(name: "O", email: "o-paths@example.com", password: "password123")
    Document.create!(title: "Theirs", folder: other.workspace.folders.create!(name: "Their folder"), created_by: other)
    team = Workspace.create!(name: "Team", user: @user)
    Document.create!(title: "Shared", folder: team.folders.create!(name: "Team folder"), created_by: @user)

    @a.update!(content: doc_with(paragraph(link_text("/their-folder/theirs"), link_text("/team-folder/shared"))))
    assert_empty @a.outgoing_links
  end

  test "a path that exists in this Space and in another is the one in this Space" do
    team = Workspace.create!(name: "Team", user: @user)
    Document.create!(title: "B", folder: team.folders.create!(name: "Docs"), created_by: @user)
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "a path to itself, or a path and an id to the same document, record one link or none" do
    @a.update!(content: doc_with(paragraph(link_text("/docs/a"), link_text("/docs/b"), link_text("/documents/#{@b.id}"), document_link(@b.id))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "links to sheets by slug path count like links by id" do
    sheet = Document.create!(title: "Budget", doc_type: :spreadsheet, folder: @folder, created_by: @user)
    @a.update!(content: doc_with(paragraph(link_text("/docs/budget"))))
    assert_equal [ sheet.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "saving looks each distinct path up once and id addresses not at all" do
    original = PathResolver.method(:find)
    calls = []
    counting = ->(workspace, segments) { calls << segments; original.call(workspace, segments) }
    content = doc_with(paragraph(
      link_text("/docs/b"), link_text("/Docs/B#intro"), link_text("#/docs/b"), link_text("/docs/c"),
      link_text("/documents/#{@b.id}"), link_text("#/documents/#{@c.id}#x"), document_link(@c.id), link_text("https://example.com/docs/b")
    ))

    PathResolver.stub(:find, counting) { @a.update!(content: content) }

    assert_equal [ %w[docs b], %w[docs c] ], calls
    assert_equal [ @b.id, @c.id ].sort, @a.outgoing_links.pluck(:target_document_id).sort
  end

  test "content with only id links or no links does no path lookup" do
    PathResolver.stub(:find, ->(*) { flunk "no path to look up" }) do
      @a.update!(content: doc_with(paragraph(link_text("/documents/#{@b.id}"), document_link(@c.id))))
      @b.update!(content: doc_with(paragraph({ "type" => "text", "text" => "plain" })))
    end
  end

  test "a document that moves to another Space looks its paths up there" do
    team = Workspace.create!(name: "Team", user: @user)
    team_docs = team.folders.create!(name: "Docs")
    team_b = Document.create!(title: "B", folder: team_docs, created_by: @user)
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)

    @a.update!(folder: team.root_folder)
    assert_equal [ team_b.id ], @a.reload.outgoing_links.pluck(:target_document_id)
  end

  test "content with nothing in it, or nothing a link, has no targets" do
    assert_empty DocumentLink.target_ids_in(nil)
    assert_empty DocumentLink.target_ids_in({})
    assert_empty DocumentLink.target_ids_in(doc_with(paragraph({ "type" => "text", "text" => "no links" })))
  end

  test "saving a document records its links and drops them when removed" do
    @a.update!(content: doc_with(paragraph(document_link(@b.id), document_link(@c.id))))
    assert_equal [ @b.id, @c.id ].sort, @a.outgoing_links.pluck(:target_document_id).sort
    assert_equal [ @a ], @b.linking_documents.to_a

    @a.update!(content: doc_with(paragraph(document_link(@c.id))))
    assert_equal [ @c.id ], @a.reload.outgoing_links.pluck(:target_document_id)
    assert_empty @b.reload.linking_documents
  end

  test "a heading link counts as a link, and a link repeated in the text is recorded once" do
    @a.update!(content: doc_with(paragraph(link_text("/documents/#{@b.id}#intro"), link_text("/documents/#{@b.id}"), document_link(@b.id))))
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "saving again without changing the links leaves them as they are" do
    @a.update!(content: doc_with(paragraph(document_link(@b.id))))
    assert_no_difference "DocumentLink.count" do
      DocumentLink.refresh!(@a)
      @a.update!(content: doc_with(paragraph(document_link(@b.id), { "type" => "text", "text" => " more" })))
    end
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "links to itself, to missing documents and to other Spaces are ignored" do
    other = User.create!(name: "O", email: "o-links@example.com", password: "password123")
    foreign = Document.create!(title: "Theirs", folder: other.workspace.folders.create!(name: "X", kind: :project), created_by: other)
    @a.update!(content: doc_with(paragraph(document_link(@a.id), document_link(999_999), document_link(foreign.id))))
    assert_empty @a.outgoing_links
  end

  test "only documents hold links, not sheets" do
    sheet = Document.create!(title: "Sheet", doc_type: :spreadsheet, folder: @folder, created_by: @user, content: doc_with(paragraph(document_link(@b.id))))
    assert_empty sheet.outgoing_links
  end

  test "a document that moves to another Space no longer links to the old one" do
    @a.update!(content: doc_with(paragraph(document_link(@b.id))))
    assert_equal 1, @a.outgoing_links.count

    team = Workspace.create!(name: "Team", user: @user)
    @a.update!(folder: team.folders.create!(name: "Plans", kind: :project))
    assert_empty @a.reload.outgoing_links
  end

  test "links are by id, so renaming or moving either document within the Space keeps the backlink" do
    @a.update!(content: doc_with(paragraph(link_text("/documents/#{@b.id}#intro"))))
    @b.update!(title: "B renamed", folder: @user.workspace.folders.create!(name: "Elsewhere", kind: :project))
    @a.update!(title: "A renamed", folder: @user.workspace.folders.create!(name: "Also elsewhere", kind: :project))
    assert_equal [ "A renamed" ], @b.reload.backlinks.map(&:title)
  end

  test "backlinks are the documents of the same Space that link here, by title, and skip a stale row from another Space" do
    @c.update!(content: doc_with(paragraph(document_link(@a.id))))
    @b.update!(content: doc_with(paragraph(link_text("/documents/#{@a.id}"))))
    other = User.create!(name: "O", email: "o-backlinks@example.com", password: "password123")
    stale = Document.create!(title: "Stale", folder: other.workspace.folders.create!(name: "X", kind: :project), created_by: other)
    DocumentLink.create!(source_document: stale, target_document: @a)

    assert_equal [ "B", "C" ], @a.backlinks.map(&:title)
    assert_empty @b.backlinks
  end

  test "rebuild_all! records the links of documents saved before links were recorded" do
    @a.update!(content: doc_with(paragraph(document_link(@b.id))))
    DocumentLink.delete_all
    DocumentLink.rebuild_all!
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "rebuild_all! reads slug paths too" do
    @a.update!(content: doc_with(paragraph(link_text("/docs/b"))))
    DocumentLink.delete_all
    DocumentLink.rebuild_all!
    assert_equal [ @b.id ], @a.outgoing_links.pluck(:target_document_id)
  end

  test "deleting either document removes the link" do
    @a.update!(content: doc_with(paragraph(document_link(@b.id))))
    assert_difference "DocumentLink.count", -1 do
      @b.destroy
    end
    assert @a.reload.persisted?
  end
end
