require "test_helper"

# Hierarchical URLs: slugs on folders and documents, and the aliases that keep
# old paths working. The pure slug rules are in test/services/slug_test.rb.
class SluggableTest < ActiveSupport::TestCase
  setup do
    @user = User.create!(name: "Slug User", email: "slug-user@example.com", password: "password123")
    @workspace = @user.workspace
    @root = @workspace.root_folder
  end

  def folder(name, parent: nil)
    @workspace.folders.create!(name: name, parent: parent, kind: parent ? :folder : :project)
  end

  def document(title, in_folder)
    in_folder.documents.create!(title: title, created_by: @user)
  end

  # Documents live in a project ("product" in the UI), never in the Root.
  def home
    @home ||= folder("Home")
  end

  def aliases
    PathAlias.where(workspace_id: @workspace.id).pluck(:path)
  end

  test "folders and documents get slugs from their names and the root has none" do
    product = folder("Product")
    spec = document("Requirements Doc", product)

    assert_nil @root.slug
    assert_equal "product", product.slug
    assert_equal "requirements-doc", spec.slug
    assert_equal [], @root.path_segments
    assert_equal [ "product", "requirements-doc" ], spec.path_segments
  end

  test "a folder and a document in the same folder never share a slug" do
    product = folder("Product")
    doc = document("Inner", product)
    other = folder("Inner", parent: product)

    assert_equal "product", product.slug
    assert_equal "inner", doc.slug
    assert_equal "inner-2", other.slug
    assert_equal "product-2", folder("Product").slug
  end

  test "the same name can be used under different folders" do
    a = folder("A")
    b = folder("B")

    assert_equal "notes", document("Notes", a).slug
    assert_equal "notes", document("Notes", b).slug
  end

  test "items directly under the root avoid reserved route names" do
    assert_equal "tasks-2", folder("Tasks").slug
    inner = folder("Inner")
    assert_equal "tasks", folder("Tasks", parent: inner).slug
  end

  test "a name with no letters or digits falls back to untitled" do
    assert_equal "untitled", document("???", home).slug
    assert_equal "untitled-2", document("!!!", home).slug
  end

  test "renaming changes the slug and the old path becomes an alias" do
    product = folder("Product")
    spec = document("Specs", product)

    product.update!(name: "Strategy")

    assert_equal "strategy", product.reload.slug
    assert_equal [ "strategy", "specs" ], spec.reload.path_segments
    assert_includes aliases, "product"
    assert_includes aliases, "product/specs"
    assert_equal product, PathAlias.find_by(workspace_id: @workspace.id, path: "product").target
    assert_equal spec, PathAlias.find_by(workspace_id: @workspace.id, path: "product/specs").target
  end

  test "a document keeps its slug when only its content changes" do
    doc = document("Brief", home)
    assert_no_difference -> { PathAlias.count } do
      doc.update!(content: { "type" => "doc" })
    end
    assert_equal "brief", doc.reload.slug
  end

  test "renaming a document remembers its old path" do
    doc = document("Draft", home)
    doc.update!(title: "Final")

    assert_equal "final", doc.reload.slug
    assert_equal [ "home/draft" ], aliases
  end

  test "moving an item gives it a slug free in the new folder and keeps the old path" do
    a = folder("A")
    b = folder("B")
    document("Notes", b)
    doc = document("Notes", a)

    doc.update!(folder: b)

    assert_equal "notes-2", doc.reload.slug
    assert_equal [ "b", "notes-2" ], doc.path_segments
    assert_includes aliases, "a/notes"
  end

  test "moving a folder remembers the old path of everything inside it" do
    a = folder("A")
    b = folder("B")
    inner = folder("Inner", parent: a)
    doc = document("Deep", inner)

    a.update!(parent: b)

    assert_equal [ "b", "a", "inner", "deep" ], doc.reload.path_segments
    assert_includes aliases, "a"
    assert_includes aliases, "a/inner"
    assert_includes aliases, "a/inner/deep"
  end

  test "a path that is in use again stops being an alias" do
    doc = document("Draft", home)
    doc.update!(title: "Final")
    assert_includes aliases, "home/draft"

    other = document("Draft", home)

    assert_equal "draft", other.slug
    assert_not_includes aliases, "home/draft"
  end

  test "destroying an item removes its aliases" do
    doc = document("Draft", home)
    doc.update!(title: "Final")
    assert_includes aliases, "home/draft"

    doc.destroy!

    assert_empty aliases
  end

  test "a document moved to another space keeps no alias there" do
    other = User.create!(name: "Other", email: "slug-other@example.com", password: "password123")
    doc = document("Brief", home)
    home
    doc.update!(folder: other.workspace.folders.create!(name: "Inbox", kind: :project))

    assert_equal "brief", doc.reload.slug
    assert_empty PathAlias.where(workspace_id: other.workspace.id)
    assert_empty aliases
  end

  test "a slug already used in the folder is rejected" do
    doc = document("Brief", home)
    other = document("Other", home)

    other.slug = doc.slug

    assert_not other.valid?
    assert_includes other.errors[:slug], "is already used in this folder"
  end

  test "slugs only contain lowercase letters, digits and hyphens" do
    doc = document("Brief", home)
    doc.slug = "Not Valid!"
    assert_not doc.valid?
  end

  test "adopting legacy folders under a new root gives them slugs" do
    @workspace.update_column(:root_folder_id, nil)
    @root.delete
    legacy = @workspace.folders.create!(name: "Legacy", kind: :project)
    assert_nil legacy.slug

    root = @workspace.ensure_document_root!

    assert_equal "legacy", legacy.reload.slug
    assert_equal root.id, legacy.parent_id
  end
end
