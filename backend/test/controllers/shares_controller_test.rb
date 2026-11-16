require "test_helper"
require_relative "../support/request_auth"

# /api/v1/shares and the public /api/v1/shared/:token: a link to a document or
# folder. Members and above make and delete links; anyone holding the token
# reads what it points at, signed in or not. (The Space's roadmap link is
# covered by roadmap_shares_controller_test.rb.)
class SharesControllerTest < ActionDispatch::IntegrationTest
  include RequestAuth

  BRIEF = { "type" => "doc", "content" => [ { "type" => "paragraph", "content" => [ { "type" => "text", "text" => "Hello" } ] } ] }.freeze

  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @owner = create_person("owner")
    @member = create_person("member")
    @viewer = create_person("viewer")
    @stranger = create_person("stranger")
    @space = Workspace.create!(name: "Studio", user: @owner)
    @space.memberships.create!(user: @member, role: :member)
    @space.memberships.create!(user: @viewer, role: :viewer)
    @folder = @space.folders.create!(name: "Plans")
    @document = @folder.documents.create!(title: "Brief", doc_type: :document, created_by: @owner, content: BRIEF)
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  # target: document_id: or folder_id:
  def create_share(user, permission: "view", **target)
    post "/api/v1/shares", params: { share: { permission: permission } }.merge(target), headers: api_headers(user), as: :json
  end

  def make_share(shareable = @document, permission: :view)
    shareable.shares.create!(permission: permission, created_by: @owner)
  end

  test "a member shares a document and gets a link token" do
    create_share(@member, document_id: @document.id)
    assert_response :created
    body = response.parsed_body
    assert body["token"].present?
    assert_equal [ "Document", @document.id, "view" ], body.values_at("shareable_type", "shareable_id", "permission")
    share = Share.find(body["id"])
    assert_equal [ body["token"], @member ], [ share.token, share.created_by ]
  end

  test "a link can allow editing, and every link has its own token" do
    create_share(@owner, permission: "edit", document_id: @document.id)
    assert_response :created
    assert_equal "edit", response.parsed_body["permission"]
    first = response.parsed_body["token"]

    create_share(@owner, document_id: @document.id)
    assert_not_equal first, response.parsed_body["token"]
  end

  test "a member shares a folder" do
    create_share(@member, folder_id: @folder.id)
    assert_response :created
    assert_equal [ "Folder", @folder.id ], response.parsed_body.values_at("shareable_type", "shareable_id")
  end

  test "a share needs something to share and its settings" do
    assert_no_difference "Share.count" do
      create_share(@member)
      assert_response :not_found

      create_share(@member, document_id: 0)
      assert_response :not_found

      post "/api/v1/shares", params: { document_id: @document.id }, headers: api_headers(@member), as: :json
      assert_response :bad_request
    end
  end

  test "a member reads a share by id" do
    share = make_share(@folder, permission: :edit)

    get "/api/v1/shares/#{share.id}", headers: api_headers(@member)
    assert_response :success
    assert_equal [ share.token, "edit", "Folder", @folder.id ], response.parsed_body.values_at("token", "permission", "shareable_type", "shareable_id")
  end

  test "a folder's share cannot be read by someone outside its Space" do
    share = make_share(@folder)

    get "/api/v1/shares/#{share.id}", headers: api_headers(@stranger)
    assert_response :not_found
  end

  test "anyone with a document link's token reads the document without signing in" do
    share = make_share

    get "/api/v1/shared/#{share.token}"
    assert_response :success
    body = response.parsed_body
    assert_equal [ "Document", "view" ], body.values_at("shareable_type", "permission")
    assert_equal [ "Brief", BRIEF ], body["resource"].values_at("title", "content")
  end

  test "anyone with a folder link's token reads the folder and its documents" do
    share = make_share(@folder)

    get "/api/v1/shared/#{share.token}"
    assert_response :success
    resource = response.parsed_body["resource"]
    assert_equal "Plans", resource["name"]
    assert_equal [ "Brief" ], resource["documents"].map { |document| document["title"] }
  end

  test "an unknown token is not found" do
    get "/api/v1/shared/not-a-real-token"
    assert_response :not_found
  end

  test "deleting a share ends the link" do
    share = make_share

    delete "/api/v1/shares/#{share.id}", headers: api_headers(@member)
    assert_response :no_content
    assert_not Share.exists?(share.id)

    get "/api/v1/shared/#{share.token}"
    assert_response :not_found
    get "/api/v1/shares/#{share.id}", headers: api_headers(@member)
    assert_response :not_found
  end

  test "deleting the shared document ends its links" do
    share = make_share

    @document.destroy!
    get "/api/v1/shared/#{share.token}"
    assert_response :not_found
  end

  test "signed-out requests cannot manage shares" do
    share = make_share

    post "/api/v1/shares", params: { document_id: @document.id, share: { permission: "view" } }, as: :json
    assert_response :unauthorized
    get "/api/v1/shares/#{share.id}"
    assert_response :unauthorized
    delete "/api/v1/shares/#{share.id}"
    assert_response :unauthorized
    assert Share.exists?(share.id)
  end

  test "a viewer cannot create or delete shares" do
    share = make_share

    assert_no_difference "Share.count" do
      create_share(@viewer, document_id: @document.id)
      assert_response :forbidden
      create_share(@viewer, folder_id: @folder.id)
      assert_response :forbidden
    end

    delete "/api/v1/shares/#{share.id}", headers: api_headers(@viewer)
    assert_response :forbidden
    assert Share.exists?(share.id)
  end

  test "someone outside the Space cannot share its documents or folders, or delete its links" do
    document_share = make_share
    folder_share = make_share(@folder)

    assert_no_difference "Share.count" do
      create_share(@stranger, document_id: @document.id)
      assert_response :not_found
      create_share(@stranger, folder_id: @folder.id)
      assert_response :not_found
    end

    delete "/api/v1/shares/#{document_share.id}", headers: api_headers(@stranger)
    assert_response :not_found
    delete "/api/v1/shares/#{folder_share.id}", headers: api_headers(@stranger)
    assert_response :not_found
    assert_equal 2, Share.count
  end
end
