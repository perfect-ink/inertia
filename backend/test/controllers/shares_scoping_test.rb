require "test_helper"

# Share links are found by id only through the Space of the folder or document
# they share (docs/features/share_links.md). Before this, any signed-in person
# could read any document share, and its token, by id.
class SharesScopingTest < ActionDispatch::IntegrationTest
  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @owner = User.create!(name: "Owner", email: "share-scope-owner@example.com", password: "password123")
    @member = User.create!(name: "Member", email: "share-scope-member@example.com", password: "password123")
    @viewer = User.create!(name: "Viewer", email: "share-scope-viewer@example.com", password: "password123")
    @stranger = User.create!(name: "Stranger", email: "share-scope-stranger@example.com", password: "password123")
    @space = Workspace.create!(name: "Studio", user: @owner)
    @space.memberships.create!(user: @member, role: :member)
    @space.memberships.create!(user: @viewer, role: :viewer)
    @folder = @space.folders.create!(name: "Plans")
    @document = @folder.documents.create!(title: "Roadmap notes", created_by: @owner)
    @folder_share = @folder.shares.create!(permission: :view, created_by: @owner)
    @document_share = @document.shares.create!(permission: :view, created_by: @owner)
    # The stranger's own Space, with a share of their own.
    @own_folder = @stranger.workspace.folders.create!(name: "Mine")
    @own_share = @own_folder.shares.create!(permission: :edit, created_by: @stranger)
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  def headers_for(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    { "Authorization" => "Bearer #{token}" }
  end

  test "someone outside the Space cannot read its document share or its token by id" do
    get "/api/v1/shares/#{@document_share.id}", headers: headers_for(@stranger)
    assert_response :not_found
    assert_not_includes response.body, @document_share.token
  end

  test "someone outside the Space cannot read its folder share by id" do
    get "/api/v1/shares/#{@folder_share.id}", headers: headers_for(@stranger)
    assert_response :not_found
    assert_not_includes response.body, @folder_share.token
  end

  test "someone outside the Space cannot delete its shares" do
    delete "/api/v1/shares/#{@document_share.id}", headers: headers_for(@stranger)
    assert_response :not_found
    delete "/api/v1/shares/#{@folder_share.id}", headers: headers_for(@stranger)
    assert_response :not_found
    assert Share.exists?(@document_share.id)
    assert Share.exists?(@folder_share.id)
  end

  test "someone outside the Space cannot create a share on its folder or document" do
    assert_no_difference "Share.count" do
      post "/api/v1/shares", params: { folder_id: @folder.id, share: { permission: "view" } }, headers: headers_for(@stranger), as: :json
      assert_response :not_found
      post "/api/v1/shares", params: { document_id: @document.id, share: { permission: "view" } }, headers: headers_for(@stranger), as: :json
      assert_response :not_found
    end
  end

  test "people in the Space read its shares, and the stranger still reads their own" do
    [ @owner, @member, @viewer ].each do |person|
      get "/api/v1/shares/#{@document_share.id}", headers: headers_for(person)
      assert_response :success
      assert_equal @document_share.token, response.parsed_body["token"]
      assert_equal "Document", response.parsed_body["shareable_type"]

      get "/api/v1/shares/#{@folder_share.id}", headers: headers_for(person)
      assert_response :success
      assert_equal @folder_share.token, response.parsed_body["token"]
    end

    get "/api/v1/shares/#{@own_share.id}", headers: headers_for(@stranger)
    assert_response :success
    assert_equal "edit", response.parsed_body["permission"]
  end

  test "someone in two Spaces reads the shares of both" do
    @space.memberships.create!(user: @stranger, role: :viewer)
    get "/api/v1/shares/#{@document_share.id}", headers: headers_for(@stranger)
    assert_response :success
    get "/api/v1/shares/#{@own_share.id}", headers: headers_for(@stranger)
    assert_response :success
  end

  test "a roadmap share (a Space's own link) is not found by id here, and still works through the roadmap endpoint" do
    roadmap = @space.shares.create!(permission: :view, created_by: @owner)
    get "/api/v1/shares/#{roadmap.id}", headers: headers_for(@owner)
    assert_response :not_found

    post "/api/v1/roadmap_share", headers: headers_for(@owner).merge("X-Workspace-Id" => @space.id.to_s), as: :json
    assert_response :created
    assert_equal roadmap.token, response.parsed_body["token"]
    get "/api/v1/shared/#{roadmap.token}"
    assert_response :success
  end

  test "an unknown permission is a 422 with errors and creates nothing" do
    assert_no_difference "Share.count" do
      post "/api/v1/shares", params: { folder_id: @folder.id, share: { permission: "bogus" } }, headers: headers_for(@member), as: :json
      assert_response :unprocessable_entity
      assert_predicate response.parsed_body["errors"], :present?

      post "/api/v1/shares", params: { document_id: @document.id, share: { permission: "bogus" } }, headers: headers_for(@member), as: :json
      assert_response :unprocessable_entity
      assert_predicate response.parsed_body["errors"], :present?
    end
  end

  test "view and edit are still accepted" do
    post "/api/v1/shares", params: { folder_id: @folder.id, share: { permission: "edit" } }, headers: headers_for(@member), as: :json
    assert_response :created
    assert_equal "edit", response.parsed_body["permission"]

    post "/api/v1/shares", params: { document_id: @document.id, share: { permission: "view" } }, headers: headers_for(@member), as: :json
    assert_response :created
    assert_equal "view", response.parsed_body["permission"]
  end

  test "ids inside share are ignored, never a 500, and cannot retarget the share" do
    post "/api/v1/shares",
      params: { folder_id: @folder.id, share: { permission: "view", folder_id: @own_folder.id, document_id: @document.id } },
      headers: headers_for(@member), as: :json
    assert_response :created
    assert_equal "Folder", response.parsed_body["shareable_type"]
    assert_equal @folder.id, response.parsed_body["shareable_id"]
    assert_equal 0, @own_folder.shares.where.not(id: @own_share.id).count
  end

  test "a viewer still cannot create or delete shares" do
    assert_no_difference "Share.count" do
      post "/api/v1/shares", params: { folder_id: @folder.id, share: { permission: "view" } }, headers: headers_for(@viewer), as: :json
      assert_response :forbidden
    end
    delete "/api/v1/shares/#{@document_share.id}", headers: headers_for(@viewer)
    assert_response :forbidden
    assert Share.exists?(@document_share.id)
  end

  test "a share link still opens without signing in" do
    get "/api/v1/shared/#{@document_share.token}"
    assert_response :success
    assert_equal "Document", response.parsed_body["shareable_type"]
  end
end
