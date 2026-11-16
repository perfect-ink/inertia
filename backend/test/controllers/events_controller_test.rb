require "test_helper"
require_relative "../support/request_auth"

# /api/v1/events: a Space's dated events (deadlines and milestones). Anyone in
# the Space reads them, members and above change them, and an open project
# (X-Project-Id) narrows the list and files new events.
class EventsControllerTest < ActionDispatch::IntegrationTest
  include RequestAuth

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
    @project = @space.folders.create!(name: "Messages", kind: :project)
    @design = @space.folders.create!(name: "Design", parent: @project)
    @other_project = @space.folders.create!(name: "Billing", kind: :project)
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  def event_params(**attributes)
    { event: { title: "Launch", date: "2026-12-01" }.merge(attributes) }
  end

  def titles = response.parsed_body.map { |event| event["title"] }

  test "lists the Space's events by date, each with its tasks" do
    task = @space.tasks.create!(title: "Write the notes")
    launch = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1), event_type: :milestone)
    @space.events.create!(title: "Beta", date: Date.new(2026, 11, 1))
    launch.event_tasks.create!(task: task)

    get "/api/v1/events", headers: api_headers(@viewer, space: @space)
    assert_response :success
    beta_json, launch_json = response.parsed_body
    assert_equal [ "Beta", "2026-11-01", "deadline", [] ], beta_json.values_at("title", "date", "event_type", "tasks")
    assert_equal [ "Launch", "2026-12-01", "milestone" ], launch_json.values_at("title", "date", "event_type")
    assert_equal [ "Write the notes" ], launch_json["tasks"].map { |t| t["title"] }
  end

  test "another Space's events are not listed" do
    @space.events.create!(title: "Ours", date: Date.new(2026, 12, 1))
    @stranger.workspace.events.create!(title: "Theirs", date: Date.new(2026, 12, 1))

    get "/api/v1/events", headers: api_headers(@member, space: @space)
    assert_equal [ "Ours" ], titles
  end

  test "an open project lists its own events and its subfolders', and folder_id narrows further" do
    @space.events.create!(title: "In project", date: Date.new(2026, 12, 1), folder: @project)
    @space.events.create!(title: "In subfolder", date: Date.new(2026, 12, 2), folder: @design)
    @space.events.create!(title: "Elsewhere", date: Date.new(2026, 12, 3), folder: @other_project)
    @space.events.create!(title: "Space-wide", date: Date.new(2026, 12, 4))

    get "/api/v1/events", headers: api_headers(@member, space: @space, project: @project)
    assert_equal [ "In project", "In subfolder" ], titles

    get "/api/v1/events", headers: api_headers(@member, space: @space)
    assert_equal 4, titles.size

    get "/api/v1/events", params: { folder_id: @design.id }, headers: api_headers(@member, space: @space, project: @project)
    assert_equal [ "In subfolder" ], titles
  end

  test "a project from another Space is not found" do
    elsewhere = @stranger.workspace.folders.create!(name: "Private", kind: :project)

    get "/api/v1/events", headers: api_headers(@member, space: @space, project: elsewhere)
    assert_response :not_found
  end

  test "a member creates an event with its type and times, filed in the open project" do
    post "/api/v1/events",
         params: event_params(event_type: "milestone", description: "Ship it", start_time: "09:00", end_time: "10:30"),
         headers: api_headers(@member, space: @space, project: @project), as: :json
    assert_response :created
    body = response.parsed_body
    assert_equal [ "Launch", "2026-12-01", "milestone", "Ship it", @project.id, [] ],
                 body.values_at("title", "date", "event_type", "description", "folder_id", "tasks")
    assert_match(/09:00:00/, body["start_time"])
    assert_match(/10:30:00/, body["end_time"])
    event = Event.find(body["id"])
    assert_equal @space.id, event.workspace_id
    assert_equal @project.id, event.folder_id
  end

  test "an event is a deadline in no project unless the request says otherwise" do
    post "/api/v1/events", params: event_params, headers: api_headers(@member, space: @space), as: :json
    assert_response :created
    assert_equal [ "deadline", nil ], response.parsed_body.values_at("event_type", "folder_id")

    post "/api/v1/events", params: event_params(folder_id: @design.id),
         headers: api_headers(@member, space: @space, project: @project), as: :json
    assert_equal @design.id, response.parsed_body["folder_id"], "a folder the request names wins over the open project"
  end

  test "an event needs a title and a date" do
    assert_no_difference "Event.count" do
      post "/api/v1/events", params: event_params(title: "", date: nil), headers: api_headers(@member, space: @space), as: :json
    end
    assert_response :unprocessable_entity
    assert_includes response.parsed_body["errors"], "Title can't be blank"
    assert_includes response.parsed_body["errors"], "Date can't be blank"
  end

  test "a member changes an event" do
    event = @space.events.create!(title: "Beta", date: Date.new(2026, 11, 1))

    patch "/api/v1/events/#{event.id}", params: { event: { title: "Beta two", date: "2026-11-15", event_type: "milestone" } },
          headers: api_headers(@member, space: @space), as: :json
    assert_response :success
    assert_equal [ "Beta two", "2026-11-15", "milestone" ], response.parsed_body.values_at("title", "date", "event_type")
    event.reload
    assert_equal [ "Beta two", Date.new(2026, 11, 15) ], [ event.title, event.date ]
    assert event.milestone?
  end

  test "an event cannot lose its title" do
    event = @space.events.create!(title: "Beta", date: Date.new(2026, 11, 1))

    patch "/api/v1/events/#{event.id}", params: { event: { title: "" } }, headers: api_headers(@member, space: @space), as: :json
    assert_response :unprocessable_entity
    assert_includes response.parsed_body["errors"], "Title can't be blank"
    assert_equal "Beta", event.reload.title
  end

  test "deleting an event unlinks its tasks but keeps them" do
    task = @space.tasks.create!(title: "Write the notes")
    event = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1))
    event.event_tasks.create!(task: task)

    delete "/api/v1/events/#{event.id}", headers: api_headers(@member, space: @space)
    assert_response :no_content
    assert_not Event.exists?(event.id)
    assert_not EventTask.exists?(event_id: event.id)
    assert Task.exists?(task.id)
  end

  test "signed-out requests are refused" do
    event = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1))

    get "/api/v1/events"
    assert_response :unauthorized
    post "/api/v1/events", params: event_params, as: :json
    assert_response :unauthorized
    patch "/api/v1/events/#{event.id}", params: { event: { title: "Nope" } }, as: :json
    assert_response :unauthorized
    delete "/api/v1/events/#{event.id}"
    assert_response :unauthorized
    assert_equal "Launch", event.reload.title
  end

  test "a viewer reads events but cannot create, change or delete them" do
    event = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1))
    headers = api_headers(@viewer, space: @space)

    assert_no_difference "Event.count" do
      post "/api/v1/events", params: event_params, headers: headers, as: :json
    end
    assert_response :forbidden

    patch "/api/v1/events/#{event.id}", params: { event: { title: "Nope" } }, headers: headers, as: :json
    assert_response :forbidden
    assert_equal "Launch", event.reload.title

    delete "/api/v1/events/#{event.id}", headers: headers
    assert_response :forbidden
    assert Event.exists?(event.id)
  end

  test "someone outside the Space cannot reach its events" do
    event = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1))
    headers = api_headers(@stranger, space: @space)

    get "/api/v1/events", headers: headers
    assert_response :not_found
    post "/api/v1/events", params: event_params, headers: headers, as: :json
    assert_response :not_found
    patch "/api/v1/events/#{event.id}", params: { event: { title: "Nope" } }, headers: headers, as: :json
    assert_response :not_found
    delete "/api/v1/events/#{event.id}", headers: headers
    assert_response :not_found
    assert_equal "Launch", event.reload.title
  end

  test "another Space's event cannot be reached through this Space" do
    theirs = @stranger.workspace.events.create!(title: "Theirs", date: Date.new(2026, 12, 1))
    headers = api_headers(@member, space: @space)

    patch "/api/v1/events/#{theirs.id}", params: { event: { title: "Mine" } }, headers: headers, as: :json
    assert_response :not_found
    assert_equal "Theirs", theirs.reload.title

    delete "/api/v1/events/#{theirs.id}", headers: headers
    assert_response :not_found
    assert Event.exists?(theirs.id)
  end
end
