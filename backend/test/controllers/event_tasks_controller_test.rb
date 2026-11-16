require "test_helper"
require_relative "../support/request_auth"

# /api/v1/events/:event_id/event_tasks: link a Space's tasks to an event and
# unlink them again. The record in the URL of a delete is the task's id.
class EventTasksControllerTest < ActionDispatch::IntegrationTest
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
    @event = @space.events.create!(title: "Launch", date: Date.new(2026, 12, 1))
    @notes = @space.tasks.create!(title: "Write the notes")
    @demo = @space.tasks.create!(title: "Record the demo")
  end

  teardown { ENV["BYPASS_AUTH"] = @previous_bypass }

  def event_tasks_path(event = @event, task_id = nil)
    [ "/api/v1/events/#{event.id}/event_tasks", task_id ].compact.join("/")
  end

  def link(task, user: @member, event: @event)
    post event_tasks_path(event), params: { task_id: task.id }, headers: api_headers(user, space: @space), as: :json
  end

  test "a member links a task to an event and gets the event back with its tasks" do
    link(@notes)
    assert_response :success
    assert_equal "Launch", response.parsed_body["title"]
    assert_equal [ "Write the notes" ], response.parsed_body["tasks"].map { |task| task["title"] }
    assert_equal [ @notes ], @event.reload.tasks.to_a
  end

  test "linking the same task twice keeps one link" do
    link(@notes)
    link(@notes)
    assert_response :success
    assert_equal 1, @event.event_tasks.count
    assert_equal 1, response.parsed_body["tasks"].size
  end

  test "a task from another Space cannot be linked" do
    theirs = @stranger.workspace.tasks.create!(title: "Theirs")

    link(theirs)
    assert_response :not_found
    assert_equal "Task not found", response.parsed_body["error"]
    assert_equal 0, @event.event_tasks.count
  end

  test "a missing or unknown task is not found" do
    post event_tasks_path, headers: api_headers(@member, space: @space), as: :json
    assert_response :not_found
    assert_equal "Task not found", response.parsed_body["error"]

    post event_tasks_path, params: { task_id: 0 }, headers: api_headers(@member, space: @space), as: :json
    assert_response :not_found
    assert_equal 0, @event.event_tasks.count
  end

  test "an event from another Space or one that does not exist is not found" do
    theirs = @stranger.workspace.events.create!(title: "Theirs", date: Date.new(2026, 12, 1))

    link(@notes, event: theirs)
    assert_response :not_found
    assert_equal "Not found", response.parsed_body["error"]
    assert_equal 0, theirs.event_tasks.count

    post "/api/v1/events/0/event_tasks", params: { task_id: @notes.id }, headers: api_headers(@member, space: @space), as: :json
    assert_response :not_found
  end

  test "unlinking removes only that task's link and keeps the task" do
    @event.event_tasks.create!(task: @notes)
    @event.event_tasks.create!(task: @demo)

    delete event_tasks_path(@event, @notes.id), headers: api_headers(@member, space: @space)
    assert_response :no_content
    assert_equal [ @demo ], @event.reload.tasks.to_a
    assert Task.exists?(@notes.id)
  end

  test "unlinking a task that was never linked changes nothing" do
    @event.event_tasks.create!(task: @notes)

    delete event_tasks_path(@event, @demo.id), headers: api_headers(@member, space: @space)
    assert_response :no_content
    assert_equal [ @notes ], @event.reload.tasks.to_a
  end

  test "signed-out requests are refused" do
    @event.event_tasks.create!(task: @notes)

    post event_tasks_path, params: { task_id: @demo.id }, as: :json
    assert_response :unauthorized
    delete event_tasks_path(@event, @notes.id)
    assert_response :unauthorized
    assert_equal [ @notes ], @event.reload.tasks.to_a
  end

  test "a viewer cannot link or unlink tasks" do
    @event.event_tasks.create!(task: @notes)

    link(@demo, user: @viewer)
    assert_response :forbidden
    delete event_tasks_path(@event, @notes.id), headers: api_headers(@viewer, space: @space)
    assert_response :forbidden
    assert_equal [ @notes ], @event.reload.tasks.to_a
  end

  test "someone outside the Space cannot link or unlink tasks" do
    @event.event_tasks.create!(task: @notes)

    link(@demo, user: @stranger)
    assert_response :not_found
    delete event_tasks_path(@event, @notes.id), headers: api_headers(@stranger, space: @space)
    assert_response :not_found
    assert_equal [ @notes ], @event.reload.tasks.to_a
  end
end
