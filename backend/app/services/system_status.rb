# What /status reports: one entry per thing the API depends on. A new
# integration adds a check here so it shows up (and turns /status red).
class SystemStatus
  CHECKS = {
    "database" => -> { ActiveRecord::Base.connection.select_value("SELECT 1") == 1 }
  }.freeze

  def self.call
    CHECKS.transform_values do |check|
      check.call ? "ok" : "down"
    rescue StandardError
      "down"
    end
  end

  def self.ok?(results = call)
    results.values.all?("ok")
  end
end
