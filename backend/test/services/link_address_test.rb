require "test_helper"

# LinkAddress is pure: no records are created here.
class LinkAddressTest < ActiveSupport::TestCase
  HOSTS = LinkAddress.host_keys([ "https://inertia.it.com", "http://localhost:5174", "capacitor://localhost" ])

  def slugs(href) = LinkAddress.slug_path(href, app_hosts: HOSTS)

  test "host keys are the http(s) origins of the app, without scheme or default port" do
    assert_equal [ "inertia.it.com", "localhost:5174" ].to_set, HOSTS
    assert_equal [ "app.test" ].to_set, LinkAddress.host_keys([ "https://App.test:443/", "  " ])
    assert_empty LinkAddress.host_keys(nil)
  end

  test "a relative path gives its slugs, lowercased, without a trailing slash, query or heading" do
    assert_equal %w[product feature-folders requirements], slugs("/product/feature-folders/requirements")
    assert_equal %w[product requirements], slugs("/Product/Requirements/")
    assert_equal %w[product requirements], slugs("/product/requirements#launch-plan")
    assert_equal %w[product requirements], slugs("/product/requirements?tab=2#launch-plan")
  end

  test "the hash router's form of a path is read too" do
    assert_equal %w[product requirements], slugs("#/product/requirements")
    assert_equal %w[product requirements], slugs("/#/product/requirements#launch-plan")
    assert_equal %w[product requirements], slugs("https://inertia.it.com/#/product/requirements")
  end

  test "a path behind one of the app's hosts counts, however the scheme, case or port is written" do
    assert_equal %w[product requirements], slugs("https://inertia.it.com/product/requirements")
    assert_equal %w[product requirements], slugs("HTTP://Inertia.it.com:80/product/requirements")
    assert_equal %w[product requirements], slugs("https://inertia.it.com:443/product/requirements")
    assert_equal %w[product requirements], slugs("http://localhost:5174/product/requirements")
  end

  test "a path behind another site, another port or user info that hides another host does not" do
    assert_nil slugs("https://github.com/product/requirements")
    assert_nil slugs("http://localhost:3000/product/requirements")
    assert_nil slugs("https://inertia.it.com@evil.test/product/requirements")
    assert_nil slugs("//inertia.it.com/product/requirements")
  end

  test "id paths and the app's own pages are not slug paths" do
    assert_nil slugs("/documents/12")
    assert_nil slugs("#/documents/12#launch-plan")
    assert_nil slugs("https://inertia.it.com/documents/12")
    assert_nil slugs("/folders/3")
    assert_nil slugs("/tasks")
    assert_nil slugs("/tasks/5")
    assert_nil slugs("/api/v1/documents")
  end

  test "a reserved word is only reserved as the first segment" do
    assert_equal %w[product tasks], slugs("/product/tasks")
  end

  test "things that are not a path, or have a segment that cannot be a slug, are not looked up" do
    [ nil, "", "  ", "/", "#intro", "https://inertia.it.com", "mailto:a@b.test", "tel:123", "javascript:alert(1)",
      "product/requirements", "/product/file.pdf", "/product/%2e%2e", "/product/a b" ].each do |href|
      assert_nil slugs(href), href.inspect
    end
  end
end
