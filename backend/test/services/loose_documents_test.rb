require "test_helper"

class LooseDocumentsTest < ActiveSupport::TestCase
  setup do
    @user = User.create!(name: "Ada", email: "loose-docs@example.com", password: "password123")
    @workspace = @user.workspace
    @root = @workspace.root_folder
  end

  # Older data: documents put where the rules no longer allow.
  def loose_document(title, folder)
    doc = @workspace.folders.create!(name: "Tmp #{title}", kind: :project).documents.create!(title: title, created_by: @user)
    doc.update_column(:folder_id, folder.id)
    doc
  end

  test "documents outside every project move into the Personal Product, which is created" do
    in_root = loose_document("Root notes", @root)
    plain = @workspace.folders.create!(name: "Archive")
    inner = @workspace.folders.create!(name: "2025", parent: plain)
    in_plain = loose_document("Old plan", inner)
    project = @workspace.folders.create!(name: "Messages", kind: :project)
    kept = project.documents.create!(title: "Brief", created_by: @user)

    assert_equal 2, LooseDocuments.new(@workspace).adopt!

    personal = @workspace.folders.find_by!(name: "Personal Product")
    assert personal.project?
    assert_equal personal, in_root.reload.folder
    # The plain folder moves whole, keeping its structure.
    assert_equal personal, plain.reload.parent
    assert_equal inner, in_plain.reload.folder
    assert_equal project, kept.reload.folder
    assert_equal 0, LooseDocuments.new(@workspace).adopt!
  end

  test "an existing Personal Project is used, and a plain folder holding a project gives up only its loose documents" do
    personal = @workspace.folders.create!(name: "Personal Project", kind: :project)
    plain = @workspace.folders.create!(name: "Clients")
    nested = @workspace.folders.create!(name: "Acme", parent: plain, kind: :project)
    loose = loose_document("Contacts", plain)

    LooseDocuments.new(@workspace).adopt!

    assert_equal personal, loose.reload.folder
    assert_equal @root, plain.reload.parent
    assert_equal plain, nested.reload.parent
    assert_not @workspace.folders.exists?(name: "Personal Product")
  end
end
