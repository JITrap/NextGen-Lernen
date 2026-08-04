import Foundation
import CoreLocation

// MARK: - Koordinate (Codable-Wrapper um CLLocationCoordinate2D)

struct Coordinate: Codable, Hashable {
    var latitude: Double
    var longitude: Double

    init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }

    init(_ coordinate: CLLocationCoordinate2D) {
        self.latitude = coordinate.latitude
        self.longitude = coordinate.longitude
    }

    var cl: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Routenprofil

enum RouteProfile: String, Codable, CaseIterable, Identifiable {
    case schnell
    case kurvig
    case superKurvig

    var id: String { rawValue }

    var label: String {
        switch self {
        case .schnell: return "Schnell"
        case .kurvig: return "Kurvig"
        case .superKurvig: return "Super-kurvig"
        }
    }

    var systemImage: String {
        switch self {
        case .schnell: return "hare.fill"
        case .kurvig: return "point.topleft.down.curvedto.point.bottomright.up"
        case .superKurvig: return "scribble.variable"
        }
    }

    /// Maximal erlaubte Verlängerung gegenüber der schnellsten Route (Faktor auf die Distanz).
    var detourBudget: Double {
        switch self {
        case .schnell: return 1.0
        case .kurvig: return 1.7
        case .superKurvig: return 2.4
        }
    }

    /// Seitlicher Versatz der Umweg-Kandidaten in Metern.
    var detourOffset: Double {
        switch self {
        case .schnell: return 0
        case .kurvig: return 4000
        case .superKurvig: return 8000
        }
    }
}

// MARK: - Geplante Route

struct RouteStep: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var instruction: String
    var distance: Double            // Meter bis zum nächsten Manöver
    var coordinate: Coordinate      // Ort des Manövers
}

struct PlannedRoute: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var name: String
    var createdAt: Date = Date()
    var start: Coordinate
    var destination: Coordinate
    var viaPoints: [Coordinate] = []
    var profile: RouteProfile
    var coordinates: [Coordinate]   // komplette Polyline
    var distance: Double            // Meter
    var expectedTravelTime: TimeInterval
    var steps: [RouteStep]
    var curvinessScore: Double      // Grad Richtungsänderung pro km
    var avoidedClosures: [String] = []
    var warnings: [String] = []

    var clCoordinates: [CLLocationCoordinate2D] { coordinates.map(\.cl) }

    static func == (lhs: PlannedRoute, rhs: PlannedRoute) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Aufgezeichnete Tour

struct TrackPoint: Codable, Hashable {
    var latitude: Double
    var longitude: Double
    var altitude: Double            // Meter
    var speed: Double               // m/s, negativ = unbekannt
    var timestamp: Date

    var cl: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    init(latitude: Double, longitude: Double, altitude: Double, speed: Double, timestamp: Date) {
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.speed = speed
        self.timestamp = timestamp
    }

    init(location: CLLocation) {
        self.latitude = location.coordinate.latitude
        self.longitude = location.coordinate.longitude
        self.altitude = location.altitude
        self.speed = location.speed
        self.timestamp = location.timestamp
    }
}

struct RecordedTrack: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var name: String
    var startedAt: Date
    var endedAt: Date
    var points: [TrackPoint]
    var distance: Double            // Meter
    var duration: TimeInterval      // Sekunden (Fahrzeit)
    var maxSpeed: Double            // m/s
    var averageSpeed: Double        // m/s
    var ascent: Double              // Höhenmeter bergauf

    var clCoordinates: [CLLocationCoordinate2D] { points.map(\.cl) }

    static func == (lhs: RecordedTrack, rhs: RecordedTrack) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - Verkehrsmeldung (Sperrung / Baustelle / Warnung)

struct ClosureEvent: Identifiable, Hashable {
    enum Kind: String, CaseIterable {
        case sperrung = "Sperrung"
        case baustelle = "Baustelle"
        case warnung = "Warnung"

        var systemImage: String {
            switch self {
            case .sperrung: return "xmark.octagon.fill"
            case .baustelle: return "cone.fill"
            case .warnung: return "exclamationmark.triangle.fill"
            }
        }
    }

    enum Source: String, CaseIterable {
        case autobahnAPI
        case osm
        case nutzer

        var label: String {
            switch self {
            case .autobahnAPI: return "Autobahn GmbH des Bundes"
            case .osm: return "OpenStreetMap"
            case .nutzer: return "Eigene Meldung"
            }
        }
    }

    var id: String
    var roadId: String              // z. B. "A7" oder "B51"
    var title: String
    var subtitle: String
    var kind: Kind
    var coordinate: Coordinate?
    var descriptionLines: [String]
    var isBlocking: Bool            // Vollsperrung ja/nein
    var startDate: Date?
    var source: Source = .autobahnAPI
}

/// Vom Nutzer selbst gemeldete Sperrung (z. B. auf einer Landstraße).
/// Wird dauerhaft gespeichert und bei jeder Routenplanung umfahren.
struct UserClosure: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var name: String
    var coordinate: Coordinate
    var createdAt: Date = Date()
}

// MARK: - Gesamtstatistik

struct RideStatistics {
    var tourCount: Int = 0
    var totalDistance: Double = 0       // Meter
    var totalDuration: TimeInterval = 0
    var maxSpeed: Double = 0            // m/s
    var totalAscent: Double = 0         // Meter
    var longestTourDistance: Double = 0 // Meter
}
