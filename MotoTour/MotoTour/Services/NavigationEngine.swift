import Foundation
import CoreLocation

/// Turn-by-Turn-Navigation: Fortschritt entlang der Route, Neuberechnung bei
/// Abweichung und automatische Anpassung bei neuen Sperrungen.
@Observable
@MainActor
final class NavigationEngine {
    enum State {
        case idle
        case navigating
        case arrived
    }

    private(set) var state: State = .idle
    private(set) var route: PlannedRoute?
    private(set) var currentStepIndex: Int = 0
    private(set) var distanceToNextManeuver: Double = 0
    private(set) var remainingDistance: Double = 0
    private(set) var remainingTime: TimeInterval = 0
    private(set) var isRerouting = false
    /// Hinweis-Banner, z. B. "Neue Sperrung auf der Route – Route wird angepasst".
    private(set) var banner: String?

    private var locationService: LocationService?
    private var routing: RoutingService?
    private var news: TrafficNewsService?
    private var settings: AppSettings?

    private var tickTask: Task<Void, Never>?
    private var lastClosureCheck = Date.distantPast
    private var offRouteSince: Date?
    private var knownClosureIDs: Set<String> = []
    /// Ob diese Engine gerade einen Dauerbetrieb-Slot im LocationService hält
    /// (verhindert doppeltes Abmelden bei Ankunft + Beenden).
    private var holdsContinuousMode = false

    var currentInstruction: String {
        guard let route, currentStepIndex < route.steps.count else { return "Dem Straßenverlauf folgen" }
        return route.steps[currentStepIndex].instruction
    }

    var nextInstruction: String? {
        guard let route, currentStepIndex + 1 < route.steps.count else { return nil }
        return route.steps[currentStepIndex + 1].instruction
    }

    // MARK: - Steuerung

    func start(route: PlannedRoute,
               locationService: LocationService,
               routing: RoutingService,
               news: TrafficNewsService,
               settings: AppSettings) {
        stop()
        self.route = route
        self.locationService = locationService
        self.routing = routing
        self.news = news
        self.settings = settings
        self.state = .navigating
        self.currentStepIndex = 0
        self.remainingDistance = route.distance
        self.remainingTime = route.expectedTravelTime
        self.banner = nil
        self.knownClosureIDs = Set(news.allEvents.compactMap { $0.coordinate != nil ? $0.id : nil })

        locationService.setContinuousMode(true)
        holdsContinuousMode = true

        tickTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.state == .navigating {
                self.tick()
                await self.checkForNewClosures()
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }

    func stop() {
        tickTask?.cancel()
        tickTask = nil
        releaseContinuousMode()
        state = .idle
        route = nil
        banner = nil
        isRerouting = false
        offRouteSince = nil
    }

    private func releaseContinuousMode() {
        guard holdsContinuousMode else { return }
        holdsContinuousMode = false
        locationService?.setContinuousMode(false)
    }

    // MARK: - Fortschritt

    private func tick() {
        guard let route, let location = locationService?.currentLocation else { return }
        let path = route.clCoordinates
        guard path.count > 1 else { return }

        let position = location.coordinate
        let index = Geo.closestPointIndex(on: path, to: position)

        // Restdistanz: vom nächsten Polyline-Punkt bis zum Ziel.
        var remaining = Geo.distance(position, path[index])
        if index + 1 < path.count {
            remaining += Geo.pathLength(Array(path[index...]))
        }
        remainingDistance = remaining
        let avgSpeed = route.expectedTravelTime > 0 ? route.distance / route.expectedTravelTime : 15
        remainingTime = remaining / max(avgSpeed, 3)

        // Ankunft erkannt?
        if Geo.distance(position, route.destination.cl) < 40 {
            state = .arrived
            banner = "Ziel erreicht"
            releaseContinuousMode()
            tickTask?.cancel()
            return
        }

        // Aktuellen Schritt bestimmen: erster Schritt, dessen Manöverpunkt noch vor uns liegt.
        var stepIndex = currentStepIndex
        while stepIndex < route.steps.count - 1 {
            let maneuver = route.steps[stepIndex].coordinate.cl
            let maneuverIndex = Geo.closestPointIndex(on: path, to: maneuver)
            if maneuverIndex < index && Geo.distance(position, maneuver) > 50 {
                stepIndex += 1
            } else {
                break
            }
        }
        currentStepIndex = stepIndex
        if stepIndex < route.steps.count {
            distanceToNextManeuver = Geo.distance(position, route.steps[stepIndex].coordinate.cl)
        }

        // Abweichung von der Route -> Neuberechnung nach 8 Sekunden.
        let deviation = Geo.distanceToPath(point: position, path: path)
        if deviation > 80 {
            if offRouteSince == nil {
                offRouteSince = Date()
            } else if Date().timeIntervalSince(offRouteSince!) > 8 {
                offRouteSince = nil
                reroute(reason: "Route wird neu berechnet …")
            }
        } else {
            offRouteSince = nil
        }
    }

    // MARK: - Sperrungs-Überwachung ("News" live)

    /// Alle 3 Minuten die Meldungen aktualisieren; taucht eine neue Sperrung auf der
    /// verbleibenden Route auf, wird automatisch eine Umfahrung berechnet.
    private func checkForNewClosures() async {
        guard state == .navigating,
              let route, let news, let settings, settings.autoRerouteOnClosures,
              Date().timeIntervalSince(lastClosureCheck) > 180 else { return }
        lastClosureCheck = Date()

        let remainingPath = remainingCoordinates(of: route)
        await news.refresh(force: true)
        await news.refreshRegional(for: remainingPath, force: true)
        let onRoute = RoutingService.closures(news.blockingEvents,
                                              near: remainingPath,
                                              threshold: settings.closureRouteThreshold)
        let newOnes = onRoute.filter { !knownClosureIDs.contains($0.id) }
        knownClosureIDs.formUnion(onRoute.map(\.id))

        if let first = newOnes.first {
            banner = "Neue Sperrung: \(first.roadId) – Route wird angepasst"
            reroute(reason: nil)
        }
    }

    private func remainingCoordinates(of route: PlannedRoute) -> [CLLocationCoordinate2D] {
        let path = route.clCoordinates
        guard let position = locationService?.currentLocation?.coordinate else { return path }
        let index = Geo.closestPointIndex(on: path, to: position)
        return Array(path[index...])
    }

    // MARK: - Neuberechnung

    private func reroute(reason: String?) {
        guard !isRerouting,
              let route, let routing, let news, let settings,
              let position = locationService?.currentLocation?.coordinate else { return }
        isRerouting = true
        if let reason { banner = reason }

        Task { [weak self] in
            guard let self else { return }
            do {
                let updated = try await routing.recalculate(route: route,
                                                            from: position,
                                                            settings: settings,
                                                            closures: news.allEvents)
                if self.state == .navigating {
                    self.route = updated
                    self.currentStepIndex = 0
                    if self.banner?.contains("Sperrung") != true {
                        self.banner = "Route aktualisiert"
                    }
                    Task { [weak self] in
                        try? await Task.sleep(nanoseconds: 6_000_000_000)
                        if self?.isRerouting == false { self?.banner = nil }
                    }
                }
            } catch {
                self.banner = "Neuberechnung fehlgeschlagen – folge weiter der alten Route"
                Task { [weak self] in
                    try? await Task.sleep(nanoseconds: 8_000_000_000)
                    if self?.isRerouting == false { self?.banner = nil }
                }
            }
            self.isRerouting = false
        }
    }
}
