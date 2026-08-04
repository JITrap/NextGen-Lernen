import Foundation
import CoreLocation

/// Lädt aktuelle Verkehrsmeldungen aus drei kostenlosen Quellen (kein API-Key):
/// 1. Autobahn-API des Bundes (verkehr.autobahn.de) – deutsche Autobahnen
/// 2. OpenStreetMap Overpass-API – Baustellen/Sperrungen auch auf Landstraßen
///    (B-, L-, K-Straßen), regional im Umkreis bzw. entlang einer Route geladen
/// 3. Eigene Meldungen des Nutzers – dauerhaft gespeichert, immer als Vollsperrung behandelt
@Observable
final class TrafficNewsService {
    private(set) var events: [ClosureEvent] = []
    private(set) var osmEvents: [ClosureEvent] = []
    private(set) var userClosures: [UserClosure] = []
    private(set) var lastUpdated: Date?
    private(set) var isLoading = false
    private(set) var isLoadingRegional = false
    private(set) var lastError: String?

    private let baseURL = URL(string: "https://verkehr.autobahn.de/o/autobahn")!
    private let overpassURL = URL(string: "https://overpass-api.de/api/interpreter")!
    private let cacheMaxAge: TimeInterval = 600 // 10 Minuten
    private let session: URLSession
    private var lastOSMKey: String?
    private var lastOSMFetch = Date.distantPast

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
        loadUserClosures()
    }

    /// Alle Meldungen aus allen Quellen (Autobahn-API, OpenStreetMap, eigene Meldungen).
    var allEvents: [ClosureEvent] {
        events + osmEvents + userClosureEvents
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

    /// Meldungen in der Nähe einer Route (alle Quellen).
    func events(near coords: [CLLocationCoordinate2D], threshold: Double) -> [ClosureEvent] {
        RoutingService.closures(allEvents, near: coords, threshold: threshold)
    }

    /// Nur Vollsperrungen (alle Quellen).
    var blockingEvents: [ClosureEvent] {
        allEvents.filter { $0.isBlocking || $0.kind == .sperrung }
    }

    // MARK: - Landstraßen (OpenStreetMap Overpass-API)

    /// Lädt Landstraßen-Meldungen im Umkreis eines Punkts (Standard: 60 km).
    @MainActor
    func refreshRegional(around center: CLLocationCoordinate2D, radiusKm: Double = 60, force: Bool = false) async {
        let dLat = radiusKm / 111.0
        let dLon = radiusKm / (111.0 * max(0.2, cos(center.latitude * .pi / 180)))
        await fetchOSM(south: center.latitude - dLat, west: center.longitude - dLon,
                       north: center.latitude + dLat, east: center.longitude + dLon, force: force)
    }

    /// Lädt Landstraßen-Meldungen entlang einer Route (Bounding Box + ~15 km Rand).
    @MainActor
    func refreshRegional(for coords: [CLLocationCoordinate2D], force: Bool = false) async {
        guard !coords.isEmpty else { return }
        let margin = 0.15
        let lats = coords.map(\.latitude)
        let lons = coords.map(\.longitude)
        await fetchOSM(south: lats.min()! - margin, west: lons.min()! - margin,
                       north: lats.max()! + margin, east: lons.max()! + margin, force: force)
    }

    @MainActor
    private func fetchOSM(south: Double, west: Double, north: Double, east: Double, force: Bool) async {
        let key = String(format: "%.1f,%.1f,%.1f,%.1f", south, west, north, east)
        if !force, key == lastOSMKey, Date().timeIntervalSince(lastOSMFetch) < cacheMaxAge { return }
        if isLoadingRegional { return }
        isLoadingRegional = true
        defer { isLoadingRegional = false }

        let bbox = String(format: "%f,%f,%f,%f", south, west, north, east)
        let query = """
        [out:json][timeout:25];
        (
          way["highway"="construction"]["construction"~"^(trunk|primary|secondary|tertiary|unclassified)$"](\(bbox));
          way["highway"~"^(trunk|primary|secondary|tertiary)$"]["access"="no"](\(bbox));
          way["highway"~"^(trunk|primary|secondary|tertiary)$"]["motor_vehicle"="no"](\(bbox));
          way["highway"~"^(trunk|primary|secondary|tertiary)$"]["construction"](\(bbox));
        );
        out center 300;
        """
        var request = URLRequest(url: overpassURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? query
        request.httpBody = ("data=" + encoded).data(using: .utf8)

        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            let decoded = try JSONDecoder().decode(OverpassResponse.self, from: data)
            osmEvents = Self.mapOSMElements(decoded.elements)
            lastOSMKey = key
            lastOSMFetch = Date()
        } catch {
            // Overpass ist ein Community-Dienst und darf ausfallen, ohne die
            // Autobahn-Meldungen zu beeinträchtigen.
        }
    }

    /// Wandelt OSM-Wege in Meldungen um; benachbarte Segmente derselben Straße
    /// werden zu einer Meldung zusammengefasst (ca. 2-km-Raster).
    private static func mapOSMElements(_ elements: [OverpassResponse.Element]) -> [ClosureEvent] {
        var merged: [String: ClosureEvent] = [:]
        for element in elements {
            guard let center = element.center else { continue }
            let tags = element.tags ?? [:]
            let road = tags["ref"] ?? tags["name"] ?? "Landstraße"
            let fullyClosed = tags["highway"] == "construction"
                || tags["access"] == "no"
                || tags["motor_vehicle"] == "no"
            let isConstruction = fullyClosed
                ? tags["highway"] == "construction"
                : tags["construction"] != nil
            let kind: ClosureEvent.Kind = isConstruction ? .baustelle : .sperrung

            let gridKey = "\(road)|\(Int(center.lat * 50))|\(Int(center.lon * 50))"
            guard merged[gridKey] == nil else { continue }

            var lines: [String] = []
            if let note = tags["note"] { lines.append(note) }
            if let description = tags["description"] { lines.append(description) }
            if let construction = tags["construction"], construction != "yes" {
                lines.append("Bauart: \(construction)")
            }
            if let opening = tags["opening_date"] { lines.append("Voraussichtlich frei ab: \(opening)") }
            lines.append("Quelle: OpenStreetMap – Angaben ohne Gewähr")

            let title: String
            if let name = tags["name"], tags["ref"] != nil {
                title = "\(road) (\(name)): \(fullyClosed ? "gesperrt" : "Bauarbeiten")"
            } else {
                title = "\(road): \(fullyClosed ? "gesperrt" : "Bauarbeiten")"
            }

            merged[gridKey] = ClosureEvent(id: "osm-\(element.id)",
                                           roadId: road,
                                           title: title,
                                           subtitle: fullyClosed ? "Strecke gesperrt (Landstraße)" : "Baustelle (Landstraße)",
                                           kind: kind,
                                           coordinate: Coordinate(latitude: center.lat, longitude: center.lon),
                                           descriptionLines: lines,
                                           isBlocking: fullyClosed,
                                           startDate: nil,
                                           source: .osm)
        }
        return merged.values.sorted { $0.roadId.localizedStandardCompare($1.roadId) == .orderedAscending }
    }

    private struct OverpassResponse: Decodable {
        struct Element: Decodable {
            struct Center: Decodable {
                let lat: Double
                let lon: Double
            }
            let id: Int64
            let center: Center?
            let tags: [String: String]?
        }
        let elements: [Element]
    }

    // MARK: - Eigene Meldungen (z. B. gesperrte Landstraßen aus der Gruppe)

    private var userClosuresURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("userclosures.json")
    }

    private var userClosureEvents: [ClosureEvent] {
        userClosures.map { closure in
            ClosureEvent(id: "nutzer-\(closure.id.uuidString)",
                         roadId: "Eigene",
                         title: closure.name,
                         subtitle: "Selbst gemeldete Sperrung – wird bei der Planung umfahren",
                         kind: .sperrung,
                         coordinate: closure.coordinate,
                         descriptionLines: ["Gemeldet am \(Format.shortDate(closure.createdAt))"],
                         isBlocking: true,
                         startDate: closure.createdAt,
                         source: .nutzer)
        }
    }

    func addUserClosure(name: String, at coordinate: CLLocationCoordinate2D) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        userClosures.append(UserClosure(name: trimmed.isEmpty ? "Gemeldete Sperrung" : trimmed,
                                        coordinate: Coordinate(coordinate)))
        saveUserClosures()
    }

    /// Löscht eine eigene Meldung anhand der Event-ID ("nutzer-<UUID>").
    func removeUserClosure(eventID: String) {
        userClosures.removeAll { "nutzer-\($0.id.uuidString)" == eventID }
        saveUserClosures()
    }

    private func loadUserClosures() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: userClosuresURL),
           let loaded = try? decoder.decode([UserClosure].self, from: data) {
            userClosures = loaded
        }
    }

    private func saveUserClosures() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(userClosures) {
            try? data.write(to: userClosuresURL, options: .atomic)
        }
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
