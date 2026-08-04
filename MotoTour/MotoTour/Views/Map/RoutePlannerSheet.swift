import SwiftUI
import MapKit
import CoreLocation

/// Sheet zur Routenplanung: Profilwahl, Start/Ziel per Suche oder Karten-Tap,
/// Zwischenpunkte, Berechnung, Ergebnisanzeige und Aktionen.
struct RoutePlannerSheet: View {
    @Environment(AppSettings.self) private var settings
    @Environment(LocationService.self) private var locationService
    @Environment(RoutingService.self) private var routing
    @Environment(TrafficNewsService.self) private var newsService
    @Environment(NavigationEngine.self) private var navigationEngine
    @Environment(TourStore.self) private var tourStore
    @Environment(\.dismiss) private var dismiss

    @Binding var plannedRoute: PlannedRoute?
    @Binding var cameraPosition: MapCameraPosition
    @Binding var startCoordinate: Coordinate?
    @Binding var destinationCoordinate: Coordinate?
    @Binding var viaPoints: [Coordinate]
    @Binding var startText: String
    @Binding var destinationText: String
    @Binding var tapPlanningEnabled: Bool

    @State private var profile: RouteProfile = .kurvig
    @State private var errorMessage = ""
    @State private var showError = false
    @State private var routeSaved = false

    var body: some View {
        NavigationStack {
            Form {
                profileSection
                pointsSection
                if !viaPoints.isEmpty {
                    viaSection
                }
                calculateSection
                if let route = plannedRoute {
                    resultSection(route)
                    actionSection(route)
                }
                resetSection
            }
            .navigationTitle("Route planen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fertig") { dismiss() }
                }
            }
            .alert("Fehler", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
            .onAppear {
                if let route = plannedRoute {
                    profile = route.profile
                }
            }
        }
    }

    // MARK: - Abschnitte

    private var profileSection: some View {
        Section("Profil") {
            Picker("Profil", selection: $profile) {
                ForEach(RouteProfile.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var pointsSection: some View {
        Section {
            PlaceSearchField(title: "Start suchen", text: $startText, coordinate: $startCoordinate)
            Button {
                useCurrentLocationAsStart()
            } label: {
                Label("Aktueller Standort als Start", systemImage: "location.fill")
            }
            .disabled(locationService.currentLocation == nil)

            PlaceSearchField(title: "Ziel suchen", text: $destinationText, coordinate: $destinationCoordinate)

            Toggle(isOn: $tapPlanningEnabled) {
                Label("Punkte per Karten-Tap setzen", systemImage: "hand.tap.fill")
            }
        } header: {
            Text("Start und Ziel")
        } footer: {
            Text("Im Tap-Modus setzt der erste Tap auf die Karte den Start, der zweite das Ziel, jeder weitere Tap einen Zwischenpunkt.")
        }
    }

    private var viaSection: some View {
        Section("Zwischenpunkte") {
            ForEach(Array(viaPoints.enumerated()), id: \.offset) { index, via in
                HStack {
                    Image(systemName: "mappin")
                        .foregroundStyle(.blue)
                    Text("Zwischenpunkt \(index + 1)")
                    Spacer()
                    Text(String(format: "%.4f, %.4f", via.latitude, via.longitude))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .onDelete { offsets in
                viaPoints.remove(atOffsets: offsets)
            }
        }
    }

    private var calculateSection: some View {
        Section {
            Button {
                calculateRoute()
            } label: {
                if routing.isCalculating {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Route wird berechnet …")
                    }
                } else {
                    Label("Route berechnen", systemImage: "arrow.triangle.turn.up.right.circle.fill")
                }
            }
            .disabled(startCoordinate == nil || destinationCoordinate == nil || routing.isCalculating)
        }
    }

    private func resultSection(_ route: PlannedRoute) -> some View {
        Section("Ergebnis") {
            LabeledContent("Distanz", value: Format.distance(route.distance))
            LabeledContent("Fahrzeit", value: Format.duration(route.expectedTravelTime))
            LabeledContent("Kurvigkeit",
                           value: "\(Int(route.curvinessScore.rounded())) °/km – \(curvinessLabel(route.curvinessScore))")
            ForEach(Array(route.warnings.enumerated()), id: \.offset) { _, warning in
                Label(warning, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
            ForEach(Array(route.avoidedClosures.enumerated()), id: \.offset) { _, closure in
                Label("Sperrung umfahren: \(closure)", systemImage: "checkmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }
        }
    }

    private func actionSection(_ route: PlannedRoute) -> some View {
        Section {
            Button {
                startNavigation(route)
            } label: {
                Label("Navigation starten", systemImage: "location.north.line.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button {
                saveRoute(route)
            } label: {
                Label(routeSaved ? "Route gespeichert" : "Route speichern",
                      systemImage: routeSaved ? "checkmark.circle.fill" : "square.and.arrow.down")
            }
            .disabled(routeSaved)
        }
    }

    private var resetSection: some View {
        Section {
            Button(role: .destructive) {
                resetPlanning()
            } label: {
                Label("Zurücksetzen", systemImage: "trash")
            }
        }
    }

    // MARK: - Aktionen

    private func useCurrentLocationAsStart() {
        guard let location = locationService.currentLocation else { return }
        startCoordinate = Coordinate(location.coordinate)
        startText = "Aktueller Standort"
    }

    private func calculateRoute() {
        guard let start = startCoordinate, let destination = destinationCoordinate else { return }
        let vias = viaPoints.map(\.cl)
        let selectedProfile = profile
        routeSaved = false
        Task { @MainActor in
            do {
                // Landstraßen-Meldungen (OpenStreetMap) für den Korridor der Route nachladen,
                // damit auch B-/L-Straßen-Sperrungen umfahren werden.
                await newsService.refresh()
                await newsService.refreshRegional(for: [start.cl, destination.cl] + vias)
                let route = try await routing.planRoute(from: start.cl,
                                                        to: destination.cl,
                                                        via: vias,
                                                        profile: selectedProfile,
                                                        settings: settings,
                                                        closures: newsService.allEvents)
                plannedRoute = route
                zoomToRoute(route)
            } catch {
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }

    private func zoomToRoute(_ route: PlannedRoute) {
        var rect = MKMapRect.null
        for coordinate in route.clCoordinates {
            let point = MKMapPoint(coordinate)
            rect = rect.union(MKMapRect(x: point.x, y: point.y, width: 0, height: 0))
        }
        guard !rect.isNull else { return }
        let padded = rect.insetBy(dx: -rect.width * 0.2 - 2000,
                                  dy: -rect.height * 0.2 - 2000)
        withAnimation {
            cameraPosition = .rect(padded)
        }
    }

    private func startNavigation(_ route: PlannedRoute) {
        navigationEngine.start(route: route,
                               locationService: locationService,
                               routing: routing,
                               news: newsService,
                               settings: settings)
        tapPlanningEnabled = false
        dismiss()
    }

    private func saveRoute(_ route: PlannedRoute) {
        tourStore.add(route: route)
        routeSaved = true
    }

    private func resetPlanning() {
        plannedRoute = nil
        startCoordinate = nil
        destinationCoordinate = nil
        viaPoints = []
        startText = ""
        destinationText = ""
        routeSaved = false
    }

    private func curvinessLabel(_ score: Double) -> String {
        switch score {
        case ..<10: return "eher gerade"
        case ..<25: return "kurvig"
        default: return "sehr kurvig"
        }
    }
}
