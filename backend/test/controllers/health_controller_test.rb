require "test_helper"
require "minitest/mock"

class HealthControllerTest < ActionDispatch::IntegrationTest
  test "health is OK without signing in" do
    get "/health"
    assert_response :success
    assert_equal "OK", response.body
  end

  test "status is 200 with every check ok" do
    get "/status"
    assert_response :success
    assert_equal "ok", response.parsed_body["database"]
  end

  test "status is 503 when a check is down" do
    SystemStatus.stub(:call, { "database" => "down" }) do
      get "/status"
      assert_response :service_unavailable
    end
  end
end
