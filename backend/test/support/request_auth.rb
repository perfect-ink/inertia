# Helpers for request tests: a person's sign-in token plus the Space
# (X-Workspace-Id) and project (X-Project-Id) a request targets.
module RequestAuth
  # Headers that sign `user` in with a JWT. Without `space` the request lands in
  # the person's own Space, like a client that sent no X-Workspace-Id.
  def api_headers(user, space: nil, project: nil)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    headers = { "Authorization" => "Bearer #{token}" }
    headers["X-Workspace-Id"] = space.id.to_s if space
    headers["X-Project-Id"] = project.id.to_s if project
    headers
  end

  # A new person with a unique email, so tests can name roles ("owner", "viewer").
  def create_person(label)
    User.create!(name: label.capitalize, email: "#{label}-#{SecureRandom.hex(4)}@example.com", password: "password123")
  end
end
