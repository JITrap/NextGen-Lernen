import Foundation
import MapKit

enum RoutingError: LocalizedError {
    case noRoute
    case network(String)

    var errorDescription: String? {
        switch self {
        case .noRoute: return "Es konnte keine Route berechnet werden. Bitte Start und Ziel prüfen."
        case .network(let message): return "Routenberechnung fehlgeschlagen: \(message)"
        }
    }
}

/// Berechnet Routen über Apple MapKit (kostenlos, kein API-Key).
/// Profile: schnell (direkteste Route), kurvig / super-kurvig (Umweg-Kandidaten,
/// bewertet nach Richtungsänderung pro Kilometer).
/// Sperrungen werden per Abstandsprüfung erkannt und mit Ausweich-Zwischenpunkten umfahren.
@Observable
final class RoutingService {
    private(set) var isCalculating = false

    // MARK: - Öffentliche API

    /// Plant eine Route inklusive Profil und Sperrungs-Umfahrung.
    @MainActor
    func planRoute(from start: CLLocationCoordinate2D,
                   to destination: CLLocationCoordinate2D,
                   via viaPoints: [CLLocationCoordinate2D] = [],
                   profile: RouteProfile,
                   settings: AppSettings,
                   closures: [ClosureEvent]) async throws -> PlannedRoute {
        isCalculating = true
        defer { isCalculating = false }

        var route = try await computeRoute(from: start, to: destination, via: viaPoints,
                                           profile: profile, settings: settings)
        route = await avoidingClosures(route: route, closures: closures, settings: settings)
        return route
    }

    /// Neuberechnung während der Navigation (z. B. Abweichung von der Route oder neue Sperrung).
    /// Bereits passierte Zwischenpunkte werden übersprungen.
    @MainActor
    func recalculate(route: PlannedRoute,
                     from current: CLLocationCoordinate2D,
                     settings: AppSettings,
                     closures: [ClosureEvent]) async throws -> PlannedRoute {
        let remainingVias = route.viaPoints.map(\.cl).filter { via in
            let viaIndex = Geo.closestPointIndex(on: route.clCoordinates, to: via)
            let currentIndex = Geo.closestPointIndex(on: route.clCoordinates, to: current)
            return viaIndex > currentIndex
        }
        var updated = try await computeRoute(from: current,
                                             to: route.destination.cl,
                                             via: remainingVias,
                                             profile: route.profile,
                                             settings: settings)
        updated = await avoidingClosures(route: updated, closures: closures, settings: settings)
        updated.name = route.name
        updated.id = route.id
        updated.viaPoints = remainingVias.map(Coordinate.init)
        return updated
    }

    /// Meldungen, die näher als `threshold` Meter an der Polyline liegen.
    static func closures(_ events: [ClosureEvent],
                         near coords: [CLLocationCoordinate2D],
                         threshold: Double) -> [ClosureEvent] {
        guard !coords.isEmpty else { return [] }
        let thinned = Geo.thin(coords, minSpacing: 200)
        return events.filter { event in
            guard let c = event.coordinate else { return false }
            return Geo.distanceToPath(point: c.cl, path: thinned) <= threshold
        }
    }

    // MARK: - Routenberechnung

    private func computeRoute(from start: CLLocationCoordinate2D,
                              to destination: CLLocationCoordinate2D,
                              via viaPoints: [CLLocationCoordinate2D],
                              profile: RouteProfile,
                              settings: AppSettings) async throws -> PlannedRoute {
        // Wegpunktkette: Start -> via… -> Ziel, segmentweise berechnen und zusammensetzen.
        let stops = [start] + viaPoints + [destination]
        var allCoords: [CLLocationCoordinate2D] = []
        var allSteps: [RouteStep] = []
        var totalDistance = 0.0
        var totalTime = 0.0

        for i in 1..<stops.count {
            let segment = try await bestSegment(from: stops[i - 1], to: stops[i],
                                                profile: profile, settings: settings)
            let coords = segment.polylineCoordinates
            if allCoords.isEmpty {
                allCoords = coords
            } else {
                allCoords.append(contentsOf: coords.dropFirst())
            }
            totalDistance += segment.distance
            totalTime += segment.expectedTravelTime
            for step in segment.steps where !step.instructions.isEmpty {
                allSteps.append(RouteStep(instruction: step.instructions,
                                          distance: step.distance,
                                          coordinate: Coordinate(step.polyline.coordinate)))
            }
        }

        guard !allCoords.isEmpty else { throw RoutingError.noRoute }

        return PlannedRoute(name: "Route",
                            start: Coordinate(start),
                            destination: Coordinate(destination),
                            viaPoints: viaPoints.map(Coordinate.init),
                            profile: profile,
                            coordinates: allCoords.map(Coordinate.init),
                            distance: totalDistance,
                            expectedTravelTime: totalTime,
                            steps: allSteps,
                            curvinessScore: Geo.curviness(of: allCoords))
    }

    /// Bestes Segment zwischen zwei Punkten gemäß Profil.
    private func bestSegment(from start: CLLocationCoordinate2D,
                             to end: CLLocationCoordinate2D,
                             profile: RouteProfile,
                             settings: AppSettings) async throws -> MKRoute {
        let directRoutes = try await requestRoutes(from: start, to: end, via: nil, settings: settings)
        guard let fastest = directRoutes.min(by: { $0.expectedTravelTime < $1.expectedTravelTime }) else {
            throw RoutingError.noRoute
        }

        if profile == .schnell {
            return fastest
        }

        // Kandidaten: direkte Alternativen + Umwege über seitlich versetzte Zwischenpunkte.
        var candidates = directRoutes
        let directCoords = fastest.polylineCoordinates
        if directCoords.count > 2, fastest.distance > 3000 {
            let third = directCoords[directCoords.count / 3]
            let twoThird = directCoords[(2 * directCoords.count) / 3]
            let heading = Geo.bearing(from: start, to: end)
            let offsets: [(CLLocationCoordinate2D, Double)] = [
                (third, heading + 90), (third, heading - 90),
                (twoThird, heading + 90), (twoThird, heading - 90),
            ]
            for (anchor, bearing) in offsets {
                let via = Geo.offset(anchor, distanceMeters: profile.detourOffset, bearingDegrees: bearing)
                if let detour = try? await requestRoutes(from: start, to: end, via: via, settings: settings).first {
                    candidates.append(detour)
                }
            }
        }

        // Bewertung: Kurvigkeit maximieren, Distanz-Budget einhalten.
        let budget = fastest.distance * profile.detourBudget
        let allowed = candidates.filter { $0.distance <= budget }
        let pool = allowed.isEmpty ? candidates : allowed
        return pool.max(by: { Geo.curviness(of: $0.polylineCoordinates) < Geo.curviness(of: $1.polylineCoordinates) }) ?? fastest
    }

    /// Einzelne MKDirections-Anfrage; bei `via` wird die Route über den Zwischenpunkt zusammengesetzt.
    private func requestRoutes(from start: CLLocationCoordinate2D,
                               to end: CLLocationCoordinate2D,
                               via: CLLocationCoordinate2D?,
                               settings: AppSettings) async throws -> [MKRoute] {
        if let via {
            let first = try await requestRoutes(from: start, to: via, via: nil, settings: settings)
            let second = try await requestRoutes(from: via, to: end, via: nil, settings: settings)
            guard let a = first.first, let b = second.first else { throw RoutingError.noRoute }
            return [StitchedRoute(segments: [a, b])]
        }

        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: start))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: end))
        request.transportType = .automobile
        request.requestsAlternateRoutes = true
        request.highwayPreference = settings.avoidHighways ? .avoid : .any
        request.tollPreference = settings.avoidTolls ? .avoid : .any

        do {
            let response = try await MKDirections(request: request).calculate()
            guard !response.routes.isEmpty else { throw RoutingError.noRoute }
            return response.routes
        } catch let error as RoutingError {
            throw error
        } catch {
            throw RoutingError.network(error.localizedDescription)
        }
    }

    // MARK: - Sperrungs-Umfahrung

    /// Prüft die Route gegen aktuelle Meldungen und versucht, blockierende Sperrungen
    /// über seitliche Ausweichpunkte zu umfahren (max. 3 Versuche).
    private func avoidingClosures(route: PlannedRoute,
                                  closures: [ClosureEvent],
                                  settings: AppSettings) async -> PlannedRoute {
        var current = route
        let blocking = { (r: PlannedRoute) -> [ClosureEvent] in
            Self.closures(closures.filter { $0.isBlocking || $0.kind == .sperrung },
                          near: r.clCoordinates,
                          threshold: settings.closureRouteThreshold)
        }

        var affected = blocking(current)
        guard !affected.isEmpty else {
            let nearby = Self.closures(closures, near: current.clCoordinates,
                                       threshold: settings.closureRouteThreshold)
            if !nearby.isEmpty {
                current.warnings.append("\(nearby.count) Verkehrsmeldung(en) entlang der Route – siehe News.")
            }
            return current
        }

        var attempt = 0
        var extraVias: [CLLocationCoordinate2D] = []
        while !affected.isEmpty && attempt < 3 {
            attempt += 1
            guard let closure = affected.first, let closureCoord = closure.coordinate?.cl else { break }

            let path = current.clCoordinates
            let idx = Geo.closestPointIndex(on: path, to: closureCoord)
            let before = path[max(0, idx - 1)]
            let after = path[min(path.count - 1, idx + 1)]
            let travelBearing = Geo.bearing(from: before, to: after)
            let side: Double = attempt.isMultiple(of: 2) ? -90 : 90
            let avoidPoint = Geo.offset(closureCoord, distanceMeters: 3000 * Double(attempt),
                                        bearingDegrees: travelBearing + side)
            extraVias.append(avoidPoint)

            let vias = route.viaPoints.map(\.cl) + extraVias
            guard let rerouted = try? await computeRoute(from: route.start.cl,
                                                         to: route.destination.cl,
                                                         via: vias,
                                                         profile: route.profile,
                                                         settings: settings) else { break }
            let stillAffected = blocking(rerouted)
            if stillAffected.count < affected.count {
                var updated = rerouted
                updated.id = current.id
                updated.name = current.name
                updated.viaPoints = route.viaPoints
                updated.avoidedClosures = current.avoidedClosures + [closure.title]
                current = updated
                affected = stillAffected
            } else {
                extraVias.removeLast()
            }
        }

        if !affected.isEmpty {
            current.warnings.append("Achtung: \(affected.count) Sperrung(en) konnten nicht umfahren werden.")
        }
        if !current.avoidedClosures.isEmpty {
            current.warnings.append("Route wurde angepasst, um \(current.avoidedClosures.count) Sperrung(en) zu umfahren.")
        }
        return current
    }
}

// MARK: - MKRoute-Helfer

extension MKRoute {
    var polylineCoordinates: [CLLocationCoordinate2D] {
        let count = polyline.pointCount
        var coords = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: count)
        polyline.getCoordinates(&coords, range: NSRange(location: 0, length: count))
        return coords
    }
}

/// Zusammengesetzte Route aus zwei Teilrouten (für Zwischenpunkt-Umwege).
private final class StitchedRoute: MKRoute {
    private let _polyline: MKPolyline
    private let _distance: CLLocationDistance
    private let _time: TimeInterval
    private let _steps: [MKRoute.Step]

    init(segments: [MKRoute]) {
        var coords: [CLLocationCoordinate2D] = []
        var distance = 0.0
        var time = 0.0
        var steps: [MKRoute.Step] = []
        for segment in segments {
            let segmentCoords = segment.polylineCoordinates
            if coords.isEmpty {
                coords = segmentCoords
            } else {
                coords.append(contentsOf: segmentCoords.dropFirst())
            }
            distance += segment.distance
            time += segment.expectedTravelTime
            steps.append(contentsOf: segment.steps)
        }
        self._polyline = MKPolyline(coordinates: coords, count: coords.count)
        self._distance = distance
        self._time = time
        self._steps = steps
        super.init()
    }

    override var polyline: MKPolyline { _polyline }
    override var distance: CLLocationDistance { _distance }
    override var expectedTravelTime: TimeInterval { _time }
    override var steps: [MKRoute.Step] { _steps }
}
