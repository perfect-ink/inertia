# Every document belongs to a project ("product" in the UI) from now on
# (Alex, 2026-11-20, who chose to move the existing ones). Documents outside
# every project move into their Space's Personal Product (see LooseDocuments).
# Nothing is deleted; the old paths keep redirecting (PathAlias). There is no
# way to know where each one came from afterwards, so down does nothing: the
# previous release still works with documents inside projects.
class MoveLooseDocumentsIntoProjects < ActiveRecord::Migration[8.1]
  def up
    LooseDocuments.adopt_all!(log: Logger.new($stdout))
  end

  def down
  end
end
