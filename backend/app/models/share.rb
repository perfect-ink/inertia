class Share < ApplicationRecord
  belongs_to :shareable, polymorphic: true
  belongs_to :created_by, class_name: "User"

  # validate: true makes an unknown permission a validation error (a 422 from
  # the controller) instead of an ArgumentError (a 500).
  enum :permission, { view: 0, edit: 1 }, validate: true

  # Shares of the folders, and of the documents in folders, of the given
  # Spaces, so a lookup by id can never reach another Space's share (and its
  # token). Roadmap shares (shareable is a Workspace) are not in this scope:
  # RoadmapSharesController manages them.
  scope :in_workspaces, lambda { |workspace_ids|
    folder_ids = Folder.where(workspace_id: workspace_ids).select(:id)
    document_ids = Document.where(folder_id: folder_ids).select(:id)
    where(shareable_type: "Folder", shareable_id: folder_ids)
      .or(where(shareable_type: "Document", shareable_id: document_ids))
  }

  before_create :generate_token

  validates :token, uniqueness: true

  private

  def generate_token
    self.token = SecureRandom.urlsafe_base64(16)
  end
end
