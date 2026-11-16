# The origins the web app is reached at, so a link in a document can be told
# from a link to another site: a hierarchical path (/product/requirements) only
# names an item here when it is relative or behind one of these hosts (see
# LinkAddress and docs/features/document_backlinks.md). They come from the
# settings the app already has for itself: the public origin (APP_URL), the
# SPA's origin in development (WEB_URL) and the origins allowed to call the API
# (CORS_ORIGINS, the same default as config/initializers/cors.rb).
Rails.application.config.x.app_origins = [
  ENV.fetch("APP_URL", "http://localhost:3847"),
  ENV.fetch("WEB_URL", ""),
  *ENV.fetch("CORS_ORIGINS", "http://localhost:5174").split(",")
].map(&:strip).reject(&:empty?).freeze
