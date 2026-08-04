import Foundation
import CoreLocation

/// Lädt aktuelle Verkehrsmeldungen (Sperrungen, Baustellen, Warnungen) von der
/// offiziellen, kostenlosen Autobahn-API des Bundes (verkehr.autobahn.de, kein API-Key).
/// Abdeckung: deutsche Autobahnen.
@Observable
final class TrafficNewsService {
    private(set) var events: [ClosureEvent] = []
    private(set) var lastUpdated: Date?
    private(set) var isLoading = false
    private(set) var lastError: String?

    private let baseURL = URL(string: "https://verkehr.autobahn.de/o/autobahn")!
    private let cacheMaxAge: TimeInterval = 600 // 10 Minuten
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }

    // MARK: - Öffentliche API

    /// Meldungen aktualisieren. Nutzt einen 10-Minuten-Cache, außer `force` ist gesetzt.
    @MainActor
    func refresh(force: Bool = false) async {
        if isLoading { return }
        if !force, let last = lastUpdated, Date().timeIntervalSince(last) < cacheMaxAge, !events.isEmpty {
            return
        }
        isLoading = true
        lastError = nil
        defer { isLoading = false }

        do {
            let roads = try await fetchRoads()
            let fetched = await fetchEvents(for: roads)
            self.events = fetched.sorted { lhs, rhs in
                if lhs.kind == rhs.kind {
                    return lhs.roadId.localizedStandardCompare(rhs.roadId) == .orderedAscending
                }
                return lhs.kind == .sperrung || (lhs.kind == .baustelle && rhs.kind == .warnung)
            }
            self.lastUpdated = Date()
        } catch {
            self.lastError = "Meldungen konnten nicht geladen werden: \(error.localizedDescription)"
        }
    }

    /// Meldungen in der Nähe einer Route.
    func events(near coords: [CLLocationCoordinate2D], threshold: Double) -> [ClosureEvent] {
        RoutingService.closures(events, near: coords, threshold: threshold)
    }

    /// Nur Vollsperrungen.
    var blockingEvents: [ClosureEvent] {
        events.filter { $0.isBlocking || $0.kind == .sperrung }
    }

    // MARK: - API-Aufrufe

    private struct RoadsResponse: Decodable {
        let roads: [String]
    }

    private func fetchRoads() async throws -> [String] {
        let (data, _) = try await session.data(from: baseURL)
        return try JSONDecoder().decode(RoadsResponse.self, from: data).roads
    }

    private func fetchEvents(for roads: [String]) async -> [ClosureEvent] {
        // Pro Autobahn zwei Endpunkte (Sperrungen + Baustellen), Parallelität begrenzt.
        var jobs: [(road: String, service: String, kind: ClosureEvent.Kind)] = []
        for road in roads {
            jobs.append((road, "closure", .sperrung))
            jobs.append((road, "roadworks", .baustelle))
        }

        var results: [ClosureEvent] = []
        let maxConcurrent = 8
        var index = 0
        await withTaskGroup(of: [ClosureEvent].self) { group in
            while index < jobs.count && index < maxConcurrent {
                let job = jobs[index]
                group.addTask { await self.fetchItems(road: job.road, service: job.service, kind: job.kind) }
                index += 1
            }
            for await items in group {
                results.append(contentsOf: items)
                if index < jobs.count {
                    let job = jobs[index]
                    group.addTask { await self.fetchItems(road: job.road, service: job.service, kind: job.kind) }
                    index += 1
                }
            }
        }
        return results
    }

    private func fetchItems(road: String, service: String, kind: ClosureEvent.Kind) async -> [ClosureEvent] {
        guard let encoded = road.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else { return [] }
        let url = baseURL.appendingPathComponent(encoded).appendingPathComponent("services/\(service)")
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return [] }
            let decoded = try JSONDecoder().decode(ItemsResponse.self, from: data)
            return decoded.items.map { $0.toEvent(road: road, kind: kind) }
        } catch {
            // Einzelne Straßen dürfen fehlschlagen, ohne den ganzen Abruf zu kippen.
            return []
        }
    }

    // MARK: - Defensive JSON-Modelle

    private struct ItemsResponse: Decodable {
        let items: [APIItem]

        private struct DynamicKey: CodingKey {
            var stringValue: String
            var intValue: Int? { nil }
            init?(stringValue: String) { self.stringValue = stringValue }
            init?(intValue: Int) { return nil }
        }

        init(from decoder: Decoder) throws {
            // Die API liefert das Array unter wechselnden Schlüsseln ("closure", "roadworks", …).
            let container = try decoder.container(keyedBy: DynamicKey.self)
            for key in container.allKeys {
                if let list = try? container.decode([APIItem].self, forKey: key) {
                    self.items = list
                    return
                }
            }
            self.items = []
        }
    }

    private struct APIItem: Decodable {
        struct APICoordinate: Decodable {
            let lat: FlexibleDouble?
            let long: FlexibleDouble?
        }

        let identifier: String?
        let title: String?
        let subtitle: String?
        let coordinate: APICoordinate?
        let description: [String]?
        let isBlocked: FlexibleBool?
        let startTimestamp: String?

        func toEvent(road: String, kind: ClosureEvent.Kind) -> ClosureEvent {
            var coord: Coordinate?
            if let lat = coordinate?.lat?.value, let lon = coordinate?.long?.value,
               abs(lat) > 0.01, abs(lon) > 0.01 {
                coord = Coordinate(latitude: lat, longitude: lon)
            }
            return ClosureEvent(id: identifier ?? UUID().uuidString,
                                roadId: road,
                                title: title ?? "\(road): \(kind.rawValue)",
                                subtitle: subtitle ?? kind.rawValue,
                                kind: kind,
                                coordinate: coord,
                                descriptionLines: (description ?? []).filter { !$0.isEmpty },
                                isBlocking: isBlocked?.value ?? (kind == .sperrung),
                                startDate: Self.parseDate(startTimestamp))
        }

        static func parseDate(_ raw: String?) -> Date? {
            guard let raw else { return nil }
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFraction.date(from: raw) { return date }
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            return plain.date(from: raw)
        }
    }

    /// Dekodiert Double-Werte, die als String oder Zahl ankommen.
    private struct FlexibleDouble: Decodable {
        let value: Double?

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let d = try? container.decode(Double.self) {
                value = d
            } else if let s = try? container.decode(String.self) {
                value = Double(s.replacingOccurrences(of: ",", with: "."))
            } else {
                value = nil
            }
        }
    }

    /// Dekodiert Bool-Werte, die als Bool oder String ("true"/"false") ankommen.
    private struct FlexibleBool: Decodable {
        let value: Bool?

        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let b = try? container.decode(Bool.self) {
                value = b
            } else if let s = try? container.decode(String.self) {
                value = (s as NSString).boolValue
            } else {
                value = nil
            }
        }
    }
}
