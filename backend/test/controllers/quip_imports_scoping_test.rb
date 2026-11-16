require "test_helper"

# A Quip import request is refused before anything is saved: no token, or a
# destination folder outside the Space, must not leave a pending import behind.
class QuipImportsScopingTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @previous_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    @user = User.create!(name: "Pat", email: "pat-quip-scope@example.com", password: "password123")
    token, = Warden::JWTAuth::UserEncoder.new.call(@user, :user, nil)
    @headers = { "Authorization" => "Bearer #{token}" }
    @workspace = @user.workspace
  end

  teardown do
    ENV["BYPASS_AUTH"] = @previous_bypass
    ActiveJob::Base.queue_adapter = @previous_adapter
  end

  test "a request without a token creates no import and queues no job" do
    assert_no_difference "QuipImport.count" do
      assert_no_enqueued_jobs only: QuipImportJob do
        post "/api/v1/quip_imports", params: { domain: "quip.com" }, headers: @headers, as: :json
      end
    end
    assert_response :bad_request

    get "/api/v1/quip_imports", headers: @headers
    assert_equal [], response.parsed_body
  end

  test "a blank token is refused the same way" do
    assert_no_difference "QuipImport.count" do
      post "/api/v1/quip_imports", params: { token: "", domain: "quip.com" }, headers: @headers, as: :json
    end
    assert_response :bad_request
  end

  test "a folder from another Space is refused and creates no import" do
    other = User.create!(name: "Sam", email: "sam-quip-scope@example.com", password: "password123")
    theirs = other.workspace.folders.create!(name: "Theirs")

    assert_no_difference "QuipImport.count" do
      assert_no_enqueued_jobs only: QuipImportJob do
        post "/api/v1/quip_imports", params: { token: "secret", destination_folder_id: theirs.id }, headers: @headers, as: :json
      end
    end
    assert_response :not_found
  end

  test "a valid request still creates the import and queues the job with the token" do
    assert_difference "QuipImport.count", 1 do
      assert_enqueued_with(job: QuipImportJob) do
        post "/api/v1/quip_imports", params: { token: "secret", domain: "quip-apple.com" }, headers: @headers, as: :json
      end
    end
    assert_response :created
    body = response.parsed_body
    assert_equal "pending", body["status"]
    assert_equal "quip-apple.com", body["domain"]
    assert_nil body["destination_folder_id"]

    imp = @workspace.quip_imports.find(body["id"])
    assert_enqueued_with(job: QuipImportJob, args: [ imp.id, "secret" ])
    assert_not_includes response.body, "secret"
  end

  test "a folder in the Space is kept as the destination" do
    folder = @workspace.folders.create!(name: "Imports")

    assert_difference "QuipImport.count", 1 do
      post "/api/v1/quip_imports", params: { token: "secret", destination_folder_id: folder.id }, headers: @headers, as: :json
    end
    assert_response :created
    assert_equal folder.id, response.parsed_body["destination_folder_id"]
    assert_equal "quip.com", response.parsed_body["domain"]
  end
end
