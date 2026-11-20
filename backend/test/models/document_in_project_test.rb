require "test_helper"

# Every document belongs to a project ("product" in the UI), Alex 2026-11-20.
class DocumentInProjectTest < ActiveSupport::TestCase
  setup do
    @user = User.create!(name: "Ada", email: "doc-in-project@example.com", password: "password123")
    @workspace = @user.workspace
    @root = @workspace.root_folder
    @project = @workspace.folders.create!(name: "Messages", kind: :project)
  end

  test "a document can be made in a project or any folder inside one" do
    inner = @workspace.folders.create!(name: "Research", parent: @project)
    assert @project.documents.create!(title: "Brief", created_by: @user).persisted?
    assert inner.documents.create!(title: "Interviews", created_by: @user).persisted?
    assert_equal @project, inner.project
  end

  test "a document can't be made outside every project" do
    plain = @workspace.folders.create!(name: "Loose")
    [ @root, plain ].each do |folder|
      doc = folder.documents.build(title: "Notes", created_by: @user)
      assert_not doc.valid?
      assert_includes doc.errors[:folder], "must be in a product"
    end
    assert_nil plain.project
  end

  test "a document can't move out of its project, but can be edited where it is" do
    doc = @project.documents.create!(title: "Brief", created_by: @user)
    assert_not doc.update(folder: @root)
    doc.reload

    # A document left outside a project by older data still saves when it stays put.
    doc.update_column(:folder_id, @root.id)
    assert doc.reload.update(title: "Renamed")
  end

  test "a folder with documents can't leave its project, and a project with documents stays one" do
    inner = @workspace.folders.create!(name: "Research", parent: @project)
    inner.documents.create!(title: "Interviews", created_by: @user)

    assert_not inner.update(parent: @root)
    assert_includes inner.errors[:base], "Documents must be in a product, so this folder can't leave one"
    assert_not @project.update(kind: :folder)

    empty = @workspace.folders.create!(name: "Empty", parent: @project)
    assert empty.update(parent: @root)
  end
end
