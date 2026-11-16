# Reads the address of a link in a document: is it a hierarchical path to an
# item in this app (/product/feature-folders/requirements), and if so which
# slugs does it hold? Plain functions with no database access, so
# DocumentLink can unit test what counts as one (docs/features/document_backlinks.md).
#
# An address counts when it is relative ("/product/requirements", or the hash
# router's "#/product/requirements" that the native apps use) or is behind the
# scheme and host of one of the app's own origins. Id paths ("/documents/12")
# and the app's own pages ("/tasks") never count: they are not slug paths, and
# the first segment of a slug path is never one of Slug::RESERVED.
module LinkAddress
  # [origin][/]#[/path]: the optional scheme and host, an optional hash-router
  # marker (only when a path follows it, so "#intro" is not one), then the path
  # up to its query or heading.
  PATTERN = %r{\A(?:(?<scheme>https?)://(?<authority>[^/?\#]*))?(?<router>/?\#(?=/))?(?<path>/[^?\#]*)?}i
  ORIGIN = %r{\A(?<scheme>https?)://(?<authority>[^/?\#]*)}i
  AUTHORITY = /\A(?<host>\[[^\]]*\]|[^:]*)(?::(?<port>\d*))?\z/
  DEFAULT_PORTS = { "http" => "80", "https" => "443" }.freeze

  module_function

  # The set of host keys for the origins the app is served from (see
  # config/initializers/app_origins.rb). Origins that are not http(s), such as
  # the iOS app's capacitor://localhost, cannot be a link's address and are left out.
  def host_keys(origins)
    Array(origins).filter_map do |origin|
      match = ORIGIN.match(origin.to_s.strip)
      host_key(match[:scheme], match[:authority]) if match
    end.to_set
  end

  # The slugs of the path an href names, lowercased ("/Product/Requirements#intro"
  # gives ["product", "requirements"]), or nil when it is not a slug path of this
  # app: another site, an id path, a page of the app, or a segment that cannot
  # be a slug (so nothing is looked up for it).
  def slug_path(href, app_hosts:)
    match = PATTERN.match(href.to_s.strip)
    return nil unless match && match[:path] && !match[:path].start_with?("//")
    return nil if match[:scheme] && !app_hosts.include?(host_key(match[:scheme], match[:authority]))

    segments = Slug.split(match[:path])
    return nil if segments.empty? || Slug::RESERVED.include?(segments.first)
    return nil unless segments.all? { |segment| segment.match?(Slug::FORMAT) }

    segments
  end

  # "App.Test:443" on https is "app.test", on port 3000 "app.test:3000", so the
  # same host is the same key however it is written. Anything before an "@" is
  # user info, not the host ("https://app.test@evil.test/x" is evil.test).
  def host_key(scheme, authority)
    match = AUTHORITY.match(authority.to_s.split("@").last.to_s.downcase)
    return nil if match.nil? || match[:host].empty?

    port = match[:port].to_s
    port.empty? || port == DEFAULT_PORTS[scheme.to_s.downcase] ? match[:host] : "#{match[:host]}:#{port}"
  end
end
