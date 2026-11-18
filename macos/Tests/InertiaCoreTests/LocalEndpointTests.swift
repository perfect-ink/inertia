import XCTest
@testable import InertiaCore

final class LocalEndpointTests: XCTestCase {
    func testLocalHosts() {
        for address in ["http://localhost:3847", "http://127.0.0.1:3847", "http://[::1]:3847", "http://app.localhost"] {
            XCTAssertTrue(LocalEndpoint.isLocal(URL(string: address)!), address)
        }
    }

    func testRemoteHostsAreNotLocal() {
        for address in ["https://inertia.it.com", "https://localhost.evil.com", "http://192.168.1.5:3847"] {
            XCTAssertFalse(LocalEndpoint.isLocal(URL(string: address)!), address)
        }
    }
}
