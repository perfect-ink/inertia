require "test_helper"
require_relative "../support/request_auth"

# /api/v1/quip_imports: start a Quip import into a Space and follow its
# progress. The Quip API token only travels to the background job (QuipImportJob);
# it is never stored on the import or sent back.
class QuipImportsControllerTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper
  include RequestAuth

  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @previous_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    @owner = create_person("owner")
    @member = create_person("member")
    @viewer = create_person("viewer")
    @stranger = create_person("stranger")
    @space = Workspace.create!(name: "Studio", user: @owner)
    @space.memberships.create!(user: @member, role: :member)
    @space.memberships.create!(user: @viewer, role: :viewer)
    @folder = @space.folders.create!(name: "Imported")
  end

  teardown do
    ENV["BYPASS_AUTH"] = @previous_bypass
    ActiveJob::Base.queue_adapter = @previous_adapter
  end

  def start_import(user: @member, token: "quip-secret", **attributes)
    post "/api/v1/quip_imports", params: { token: token }.merge(attributes), headers: api_headers(user, space: @space), as: :json
  end

  test "a member starts an import and the token goes to the background job only" do
    start_import(domain: "quip-apple.com", destination_folder_id: @folder.id)
    assert_response :created
    body = response.parsed_body
    assert_equal [ "pending", "quip-apple.com", @folder.id, 0, 0, 0 ],
                 body.values_at("status", "domain", "destination_folder_id", "folders_created", "documents_imported", "documents_failed")
    assert_not_includes response.body, "quip-secret"

    quip_import = @space.quip_imports.find(body["id"])
    assert quip_import.pending?
    assert_equal @folder, quip_import.destination_folder
    assert_enqueued_with(job: QuipImportJob, args: [ quip_import.id, "quip-secret" ])
  end

  test "an import defaults to quip.com and to the Space's root" do
    start_import
    assert_response :created
    assert_equal [ "quip.com", nil ], response.parsed_body.values_at("domain", "destination_folder_id")
  end

  test "only the two Quip domains are accepted, and no job is queued for another" do
    assert_no_difference "QuipImport.count" do
      start_import(domain: "example.com")
    end
    assert_response :unprocessable_entity
    assert_no_enqueued_jobs only: QuipImportJob
  end

  test "an import without a token is refused and queues no job" do
    start_import(token: nil)
    assert_response :bad_request
    assert_no_enqueued_jobs only: QuipImportJob
  end

  test "lists the Space's imports, newest first" do
    old = @space.quip_imports.create!(domain: "quip.com", created_at: 2.days.ago)
    recent = @space.quip_imports.create!(domain: "quip-apple.com", created_at: 1.hour.ago)
    @stranger.workspace.quip_imports.create!(domain: "quip.com")

    get "/api/v1/quip_imports", headers: api_headers(@viewer, space: @space)
    assert_response :success
    assert_equal [ recent.id, old.id ], response.parsed_body.map { |quip_import| quip_import["id"] }
  end

  test "shows one import with its progress" do
    quip_import = @space.quip_imports.create!(domain: "quip.com", status: :completed, folders_created: 2, documents_imported: 5, documents_failed: 1)

    get "/api/v1/quip_imports/#{quip_import.id}", headers: api_headers(@viewer, space: @space)
    assert_response :success
    assert_equal [ quip_import.id, "completed", 2, 5, 1 ],
                 response.parsed_body.values_at("id", "status", "folders_created", "documents_imported", "documents_failed")
  end

  test "another Space's import is not found" do
    theirs = @stranger.workspace.quip_imports.create!(domain: "quip.com")

    get "/api/v1/quip_imports/#{theirs.id}", headers: api_headers(@member, space: @space)
    assert_response :not_found
  end

  test "signed-out requests are refused" do
    quip_import = @space.quip_imports.create!(domain: "quip.com")

    get "/api/v1/quip_imports"
    assert_response :unauthorized
    get "/api/v1/quip_imports/#{quip_import.id}"
    assert_response :unauthorized
    post "/api/v1/quip_imports", params: { token: "quip-secret" }, as: :json
    assert_response :unauthorized
    assert_no_enqueued_jobs only: QuipImportJob
  end

  test "a viewer can follow imports but not start one" do
    assert_no_difference "QuipImport.count" do
      start_import(user: @viewer)
    end
    assert_response :forbidden
    assert_no_enqueued_jobs only: QuipImportJob
  end

  test "someone outside the Space cannot list, read or start its imports" do
    quip_import = @space.quip_imports.create!(domain: "quip.com")
    headers = api_headers(@stranger, space: @space)

    get "/api/v1/quip_imports", headers: headers
    assert_response :not_found
    get "/api/v1/quip_imports/#{quip_import.id}", headers: headers
    assert_response :not_found

    assert_no_difference "QuipImport.count" do
      start_import(user: @stranger)
    end
    assert_response :not_found
    assert_no_enqueued_jobs only: QuipImportJob
  end
end
