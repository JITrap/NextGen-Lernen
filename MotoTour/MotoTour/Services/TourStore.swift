import Foundation
import CoreLocation

/// Persistenz für aufgezeichnete Touren und geplante Routen als JSON im Documents-Ordner.
/// Zusätzlich GPX-Export/-Import (kompatibel mit anderen Navigations-Apps).
@Observable
final class TourStore {
    private(set) var tracks: [RecordedTrack] = []
    private(set) var routes: [PlannedRoute] = []

    private var tracksURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("tracks.json")
    }
    private var routesURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("routes.json")
    }

    init() {
        load()
    }

    // MARK: - Touren

    func add(track: RecordedTrack) {
        tracks.insert(track, at: 0)
        saveTracks()
    }

    func delete(track: RecordedTrack) {
        tracks.removeAll { $0.id == track.id }
        saveTracks()
    }

    func rename(track: RecordedTrack, to name: String) {
        guard let index = tracks.firstIndex(where: { $0.id == track.id }) else { return }
        tracks[index].name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        saveTracks()
    }

    // MARK: - Routen

    func add(route: PlannedRoute) {
        var saved = route
        if saved.name == "Route" {
            saved.name = "Route \(Format.shortDate(saved.createdAt))"
        }
        routes.insert(saved, at: 0)
        saveRoutes()
    }

    func delete(route: PlannedRoute) {
        routes.removeAll { $0.id == route.id }
        saveRoutes()
    }

    func rename(route: PlannedRoute, to name: String) {
        guard let index = routes.firstIndex(where: { $0.id == route.id }) else { return }
        routes[index].name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        saveRoutes()
    }

    // MARK: - Statistik

    var statistics: RideStatistics {
        var stats = RideStatistics()
        stats.tourCount = tracks.count
        for track in tracks {
            stats.totalDistance += track.distance
            stats.totalDuration += track.duration
            stats.maxSpeed = max(stats.maxSpeed, track.maxSpeed)
            stats.totalAscent += track.ascent
            stats.longestTourDistance = max(stats.longestTourDistance, track.distance)
        }
        return stats
    }

    /// Kilometer pro Jahr, absteigend nach Jahr sortiert.
    var distanceByYear: [(year: Int, distance: Double)] {
        var byYear: [Int: Double] = [:]
        let calendar = Calendar.current
        for track in tracks {
            let year = calendar.component(.year, from: track.startedAt)
            byYear[year, default: 0] += track.distance
        }
        return byYear.map { (year: $0.key, distance: $0.value) }.sorted { $0.year > $1.year }
    }

    // MARK: - Laden & Speichern

    private func load() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let data = try? Data(contentsOf: tracksURL),
           let loaded = try? decoder.decode([RecordedTrack].self, from: data) {
            tracks = loaded
        }
        if let data = try? Data(contentsOf: routesURL),
           let loaded = try? decoder.decode([PlannedRoute].self, from: data) {
            routes = loaded
        }
    }

    private func saveTracks() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(tracks) {
            try? data.write(to: tracksURL, options: .atomic)
        }
    }

    private func saveRoutes() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(routes) {
            try? data.write(to: routesURL, options: .atomic)
        }
    }

    // MARK: - GPX-Export

    func gpx(for track: RecordedTrack) -> String {
        let formatter = ISO8601DateFormatter()
        var lines: [String] = []
        lines.append(#"<?xml version="1.0" encoding="UTF-8"?>"#)
        lines.append(#"<gpx version="1.1" creator="MotoTour" xmlns="http://www.topografix.com/GPX/1/1">"#)
        lines.append("  <trk><name>\(Self.escapeXML(track.name))</name><trkseg>")
        for point in track.points {
            lines.append(String(format: #"    <trkpt lat="%.6f" lon="%.6f"><ele>%.1f</ele><time>%@</time></trkpt>"#,
                                point.latitude, point.longitude, point.altitude,
                                formatter.string(from: point.timestamp)))
        }
        lines.append("  </trkseg></trk>")
        lines.append("</gpx>")
        return lines.joined(separator: "\n")
    }

    func gpx(for route: PlannedRoute) -> String {
        var lines: [String] = []
        lines.append(#"<?xml version="1.0" encoding="UTF-8"?>"#)
        lines.append(#"<gpx version="1.1" creator="MotoTour" xmlns="http://www.topografix.com/GPX/1/1">"#)
        lines.append("  <rte><name>\(Self.escapeXML(route.name))</name>")
        for coordinate in route.coordinates {
            lines.append(String(format: #"    <rtept lat="%.6f" lon="%.6f"/>"#,
                                coordinate.latitude, coordinate.longitude))
        }
        lines.append("  </rte>")
        lines.append("</gpx>")
        return lines.joined(separator: "\n")
    }

    /// Schreibt eine GPX-Datei ins Temp-Verzeichnis und liefert die URL (für ShareLink).
    func exportURL(for track: RecordedTrack) -> URL? {
        writeGPX(content: gpx(for: track), name: track.name)
    }

    func exportURL(for route: PlannedRoute) -> URL? {
        writeGPX(content: gpx(for: route), name: route.name)
    }

    private func writeGPX(content: String, name: String) -> URL? {
        let safeName = name.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safeName).gpx")
        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }

    private static func escapeXML(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    // MARK: - GPX-Import

    enum ImportResult {
        case track(RecordedTrack)
        case failed(String)
    }

    /// Importiert eine GPX-Datei (Track-Punkte) als Tour.
    func importGPX(data: Data, suggestedName: String) -> ImportResult {
        let parser = GPXParser()
        let points = parser.parse(data: data)
        guard points.count >= 2 else {
            return .failed("Keine Track-Punkte in der GPX-Datei gefunden.")
        }
        let distance = Geo.pathLength(points.map(\.cl))
        let started = points.first!.timestamp
        let ended = points.last!.timestamp
        let duration = max(ended.timeIntervalSince(started), 1)
        let track = RecordedTrack(name: suggestedName.isEmpty ? "Importierte Tour" : suggestedName,
                                  startedAt: started,
                                  endedAt: ended,
                                  points: points,
                                  distance: distance,
                                  duration: duration,
                                  maxSpeed: 0,
                                  averageSpeed: duration > 1 ? distance / duration : 0,
                                  ascent: 0)
        add(track: track)
        return .track(track)
    }
}

/// Minimaler GPX-Parser für <trkpt>/<rtept> mit optionalen <ele>- und <time>-Kindern.
private final class GPXParser: NSObject, XMLParserDelegate {
    private var points: [TrackPoint] = []
    private var currentLat: Double?
    private var currentLon: Double?
    private var currentEle: Double = 0
    private var currentTime: Date?
    private var currentText = ""
    private let dateFormatter = ISO8601DateFormatter()

    func parse(data: Data) -> [TrackPoint] {
        points = []
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
        return points
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?, attributes attributeDict: [String: String] = [:]) {
        currentText = ""
        if elementName == "trkpt" || elementName == "rtept" {
            currentLat = attributeDict["lat"].flatMap(Double.init)
            currentLon = attributeDict["lon"].flatMap(Double.init)
            currentEle = 0
            currentTime = nil
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        currentText += string
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?,
                qualifiedName qName: String?) {
        switch elementName {
        case "ele":
            currentEle = Double(currentText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        case "time":
            currentTime = dateFormatter.date(from: currentText.trimmingCharacters(in: .whitespacesAndNewlines))
        case "trkpt", "rtept":
            if let lat = currentLat, let lon = currentLon {
                let fallback = points.last?.timestamp.addingTimeInterval(1) ?? Date()
                points.append(TrackPoint(latitude: lat, longitude: lon, altitude: currentEle,
                                         speed: -1, timestamp: currentTime ?? fallback))
            }
        default:
            break
        }
    }
}
