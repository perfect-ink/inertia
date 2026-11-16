require "test_helper"
require_relative "../support/request_auth"

# /api/v1/workspaces/:workspace_id/teams/:team_id/members: add an existing user
# to a team by email, and remove someone. Admins and owners (their own role or
# the one their team gives them) manage people; both actions answer with the
# updated team. teams_controller_test.rb covers how team roles then decide what
# a team's people can do.
class TeamMembersControllerTest < ActionDispatch::IntegrationTest
  include RequestAuth

  setup do
    @previous_bypass = ENV["BYPASS_AUTH"]
    ENV["BYPASS_AUTH"] = "false"
    @owner = create_person("owner")
    @admin = create_person("admin")
    @member = create_person("member")
    @viewer = create_person("viewer")
    @ada = create_person("ada")
    @bo = create_person("bo")
    @cy = create_person("cy")
    @stranger = create_person("stranger")
    @space = Workspace.create!(name: "Studio", user: @owner)
    @space.memberships.create!(user: @admin, role: :admin)
    @space.memberships.create!(user: @member, role: :member)
    @space.memberships.create!(user: @viewer, role: :viewer)
    @design = @space.teams.create!(name: "Design", role: :member)
    @design_ada = @design.memberships.create!(user: @ada)
    @writers = @space.teams.create!(name: "Writers", role: :member)
    @writers_cy = @writers.memberships.create!(user: @cy)
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  def members_path(team = @design, membership_id = nil)
    [ "/api/v1/workspaces/#{@space.id}/teams/#{team.id}/members", membership_id ].compact.join("/")
  end

  def emails = response.parsed_body["members"].map { |person| person["user"]["email"] }

  # The users on a team, read from the database.
  def people(team = @design) = TeamMembership.where(team_id: team.id).order(:id).pluck(:user_id)

  test "an admin adds an existing user by email and gets the team back" do
    post members_path, params: { email: " #{@bo.email.upcase} " }, headers: api_headers(@admin), as: :json
    assert_response :created
    body = response.parsed_body
    assert_equal [ @design.id, "Design", "member", @space.id ], body.values_at("id", "name", "role", "workspace_id")
    assert_equal [ @ada.email, @bo.email ], emails
    added = body["members"].last
    assert_equal [ @design.memberships.find_by!(user: @bo).id, @bo.id, "Bo" ], [ added["id"], added["user_id"], added["user"]["name"] ]
  end

  test "an owner adds people too" do
    post members_path, params: { email: @bo.email }, headers: api_headers(@owner), as: :json
    assert_response :created
    assert @design.memberships.exists?(user: @bo)
  end

  test "a person on a team with the admin role can add people" do
    @design.update!(role: :admin)

    post members_path(@writers), params: { email: @bo.email }, headers: api_headers(@ada), as: :json
    assert_response :created
    assert @writers.memberships.exists?(user: @bo)
  end

  test "an email is needed, and it must belong to a user who is not on the team yet" do
    post members_path, params: { email: "" }, headers: api_headers(@admin), as: :json
    assert_response :bad_request

    post members_path, params: { email: "nobody@example.com" }, headers: api_headers(@admin), as: :json
    assert_response :unprocessable_entity
    assert_equal [ "No user with that email" ], response.parsed_body["errors"]

    post members_path, params: { email: @ada.email }, headers: api_headers(@admin), as: :json
    assert_response :unprocessable_entity
    assert response.parsed_body["errors"].present?
    assert_equal 1, @design.memberships.count
  end

  test "an admin removes someone from a team and gets the team back" do
    delete members_path(@design, @design_ada.id), headers: api_headers(@admin)
    assert_response :success
    assert_equal [], response.parsed_body["members"]
    assert_not TeamMembership.exists?(@design_ada.id)
    assert User.exists?(@ada.id)
  end

  test "a membership of another team or one that does not exist is not found" do
    delete members_path(@design, @writers_cy.id), headers: api_headers(@admin)
    assert_response :not_found
    assert TeamMembership.exists?(@writers_cy.id)

    delete members_path(@design, 0), headers: api_headers(@admin)
    assert_response :not_found
    assert_equal 1, @design.memberships.count
  end

  test "a team from another Space is not found through this Space" do
    other = Workspace.create!(name: "Other", user: @owner)
    theirs = other.teams.create!(name: "Strangers")

    post members_path(theirs), params: { email: @bo.email }, headers: api_headers(@owner), as: :json
    assert_response :not_found
    assert_equal 0, theirs.memberships.count
  end

  test "signed-out requests are refused" do
    post members_path, params: { email: @bo.email }, as: :json
    assert_response :unauthorized
    delete members_path(@design, @design_ada.id)
    assert_response :unauthorized
    assert_equal [ @ada.id ], people
  end

  test "members and viewers cannot add or remove people" do
    [ @member, @viewer ].each do |person|
      post members_path, params: { email: @bo.email }, headers: api_headers(person), as: :json
      assert_response :forbidden

      delete members_path(@design, @design_ada.id), headers: api_headers(person)
      assert_response :forbidden
    end
    assert_equal [ @ada.id ], people
  end

  test "someone outside the Space cannot add or remove people" do
    post members_path, params: { email: @bo.email }, headers: api_headers(@stranger), as: :json
    assert_response :not_found
    delete members_path(@design, @design_ada.id), headers: api_headers(@stranger)
    assert_response :not_found
    assert_equal [ @ada.id ], people
  end
end
