# Liveness (/health) and dependency status (/status); see docs/rules/backend.md.
# Public and unauthenticated, so a sibling of ApplicationController like
# MarketingController. /up stays as the Rails default the container check uses.
class HealthController < ActionController::API
  def show
    render plain: "OK"
  end

  def status
    results = SystemStatus.call
    render json: results, status: SystemStatus.ok?(results) ? :ok : :service_unavailable
  end
end
