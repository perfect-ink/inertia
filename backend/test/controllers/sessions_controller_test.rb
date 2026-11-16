require "test_helper"
require_relative "../support/request_auth"

# POST /api/v1/auth/login and DELETE /api/v1/auth/logout: Devise sessions that
# answer in JSON, with the JWT in the Authorization header (devise-jwt) and
# revoked on logout. The development shortcut ("admin"/"admin") is covered by
# development_login_test.rb and sign-up by signup_api_test.rb.
class SessionsControllerTest < ActionDispatch::IntegrationTest
  include RequestAuth

  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @user = User.create!(name: "Ada", email: "ada-sessions@example.com", password: "password123")
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  def log_in(email: "ada-sessions@example.com", password: "password123")
    post "/api/v1/auth/login", params: { user: { email: email, password: password } }, as: :json
  end

  test "signing in returns the user, a message and a bearer token" do
    log_in
    assert_response :success
    body = response.parsed_body
    assert_equal "Logged in successfully", body["message"]
    assert_equal [ @user.id, "Ada", "ada-sessions@example.com" ], body["user"].values_at("id", "name", "email")
    assert_not_includes body["user"].keys, "encrypted_password"
    assert response.headers.fetch("Authorization").start_with?("Bearer ")
  end

  test "the email is matched without regard to case or surrounding spaces" do
    log_in(email: " ADA-Sessions@Example.com ")
    assert_response :success
    assert_equal @user.id, response.parsed_body.dig("user", "id")
  end

  test "a wrong password is refused and no token is issued" do
    log_in(password: "not-the-password")
    assert_response :unauthorized
    assert_nil response.headers["Authorization"]
  end

  test "an unknown email is refused and no token is issued" do
    log_in(email: "nobody@example.com")
    assert_response :unauthorized
    assert_nil response.headers["Authorization"]
  end

  test "signing out revokes the token and answers with a message" do
    headers = api_headers(@user)

    get "/api/v1/workspaces", headers: headers
    assert_response :success

    delete "/api/v1/auth/logout", headers: headers
    assert_response :success
    assert_equal "Logged out successfully", response.parsed_body["message"]

    get "/api/v1/workspaces", headers: headers
    assert_response :unauthorized
  end

  test "signing out without a token still answers with the message" do
    delete "/api/v1/auth/logout"
    assert_response :success
    assert_equal "Logged out successfully", response.parsed_body["message"]
  end
end
