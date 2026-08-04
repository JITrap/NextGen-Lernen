import SwiftUI
import MapKit
import CoreLocation

/// Karten-Hauptbildschirm: Karte mit geplanter Route, Verkehrsmeldungen,
/// POI-Suche, Routenplanung per Karten-Tap und Tour-Aufzeichnung.
struct MapScreen: View {
    @Environment(AppSettings.self) private var settings
    @Environment(LocationService.self) private var locationService
    @Environment(TrafficNewsService.self) private var newsService
    @Environment(TourStore.self) private var tourStore

    // Karte
    @State private var cameraPosition: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var visibleRegion: MKCoordinateRegion?

    // Routenplanung
    @State private var plannedRoute: PlannedRoute?
    @State private var showPlanner = false
    @State private var tapPlanningEnabled = false
    @State private var startCoordinate: Coordinate?
    @State private var destinationCoordinate: Coordinate?
    @State private var viaPoints: [Coordinate] = []
    @State private var startText = ""
    @State private var destinationText = ""

    // Verkehrsmeldungen
    @State private var showTrafficEvents = true
    @State private var selectedEvent: ClosureEvent?

    // Eigene Sperrung melden
    @State private var reportModeEnabled = false
    @State private var pendingReportCoordinate: CLLocationCoordinate2D?
    @State private var reportName = ""

    // POI-Suche
    @State private var poiItems: [MKMapItem] = []
    @State private var activePOICategory: POICategory?

    // Aufzeichnung
    @State private var trackSavedMessage: String?

    var body: some View {
        MapReader { proxy in
            Map(position: $cameraPosition) {
                mapContent
            }
            .mapStyle(settings.mapStyleOption.mapStyle)
            .mapControls {
                MapUserLocationButton()
                MapCompass()
                MapScaleView()
            }
            .onMapCameraChange { context in
                visibleRegion = context.region
            }
            .onTapGesture { point in
                guard let coordinate = proxy.convert(point, from: .local) else { return }
                if reportModeEnabled {
                    pendingReportCoordinate = coordinate
                    reportName = ""
                } else if tapPlanningEnabled {
                    handlePlanningTap(coordinate)
                }
            }
        }
        .overlay(alignment: .topLeading) { topLeadingControls }
        .overlay(alignment: .top) { statusOverlays }
        .safeAreaInset(edge: .bottom) { bottomBar }
        .sheet(isPresented: $showPlanner) { plannerSheet }
        .sheet(item: $selectedEvent) { event in
            TrafficEventDetailSheet(event: event)
                .presentationDetents([.medium, .large])
        }
        .alert("Sperrung melden", isPresented: reportAlertBinding) {
            TextField("Beschreibung (z. B. B51 bei Ort gesperrt)", text: $reportName)
            Button("Melden") {
                if let coordinate = pendingReportCoordinate {
                    newsService.addUserClosure(name: reportName, at: coordinate)
                }
                pendingReportCoordinate = nil
                reportModeEnabled = false
            }
            Button("Abbrechen", role: .cancel) {
                pendingReportCoordinate = nil
            }
        } message: {
            Text("Die Stelle wird als Vollsperrung gespeichert und bei jeder Routenplanung automatisch umfahren.")
        }
        .onAppear { locationService.startUpdating() }
        .onDisappear { locationService.stopUpdating() }
        .task(id: locationService.currentLocation == nil) {
            await newsService.refresh()
            if let location = locationService.currentLocation {
                await newsService.refreshRegional(around: location.coordinate)
            }
        }
    }

    private var reportAlertBinding: Binding<Bool> {
        Binding(
            get: { pendingReportCoordinate != nil },
            set: { showing in
                if !showing { pendingReportCoordinate = nil }
            }
        )
    }

    // MARK: - Karteninhalt

    @MapContentBuilder
    private var mapContent: some MapContent {
        UserAnnotation()

        if let route = plannedRoute {
            MapPolyline(coordinates: route.clCoordinates)
                .stroke(.blue, lineWidth: 5)
            Marker("Start", systemImage: "flag.fill", coordinate: route.start.cl)
                .tint(.green)
            Marker("Ziel", systemImage: "flag.checkered", coordinate: route.destination.cl)
                .tint(.red)
            ForEach(Array(route.viaPoints.enumerated()), id: \.offset) { index, via in
                Marker("Zwischenpunkt \(index + 1)", systemImage: "mappin", coordinate: via.cl)
                    .tint(.blue)
            }
        } else {
            if let start = startCoordinate {
                Marker("Start", systemImage: "flag.fill", coordinate: start.cl)
                    .tint(.green)
            }
            if let destination = destinationCoordinate {
                Marker("Ziel", systemImage: "flag.checkered", coordinate: destination.cl)
                    .tint(.red)
            }
            ForEach(Array(viaPoints.enumerated()), id: \.offset) { index, via in
                Marker("Zwischenpunkt \(index + 1)", systemImage: "mappin", coordinate: via.cl)
                    .tint(.blue)
            }
        }

        if showTrafficEvents {
            ForEach(visibleEvents) { event in
                if let coordinate = event.coordinate {
                    Annotation(event.roadId, coordinate: coordinate.cl) {
                        Button {
                            selectedEvent = event
                        } label: {
                            Image(systemName: event.kind.systemImage)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(event.kind == .warnung ? Color.black : Color.white)
                                .padding(6)
                                .background(event.source == .nutzer ? Color.purple : eventColor(event.kind), in: Circle())
                                .shadow(radius: 2)
                        }
                    }
                }
            }
        }

        ForEach(poiItems, id: \.self) { item in
            Marker(item.name ?? "Ort",
                   systemImage: activePOICategory?.systemImage ?? "mappin",
                   coordinate: item.placemark.coordinate)
                .tint(.purple)
        }
    }

    /// Meldungen mit Koordinate im sichtbaren Kartenausschnitt (begrenzt, damit die Karte flüssig bleibt).
    private var visibleEvents: [ClosureEvent] {
        let withCoordinate = newsService.allEvents.filter { $0.coordinate != nil }
        guard let region = visibleRegion else { return Array(withCoordinate.prefix(120)) }
        let halfLat = region.span.latitudeDelta / 2
        let halfLon = region.span.longitudeDelta / 2
        let inView = withCoordinate.filter { event in
            guard let c = event.coordinate else { return false }
            return abs(c.latitude - region.center.latitude) <= halfLat
                && abs(c.longitude - region.center.longitude) <= halfLon
        }
        return Array(inView.prefix(120))
    }

    // MARK: - Overlays

    private var topLeadingControls: some View {
        VStack(spacing: 10) {
            Button {
                showTrafficEvents.toggle()
            } label: {
                Image(systemName: showTrafficEvents ? "exclamationmark.triangle.fill" : "exclamationmark.triangle")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(showTrafficEvents ? Color.orange : Color.secondary)
                    .frame(width: 44, height: 44)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel(showTrafficEvents ? "Verkehrsmeldungen ausblenden" : "Verkehrsmeldungen einblenden")

            Menu {
                ForEach(POICategory.allCases) { category in
                    Button {
                        togglePOI(category)
                    } label: {
                        Label(activePOICategory == category ? "\(category.label) ausblenden" : category.label,
                              systemImage: category.systemImage)
                    }
                }
            } label: {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(activePOICategory != nil ? Color.purple : Color.secondary)
                    .frame(width: 44, height: 44)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel("POI-Suche")

            Button {
                reportModeEnabled.toggle()
            } label: {
                Image(systemName: reportModeEnabled ? "exclamationmark.bubble.fill" : "exclamationmark.bubble")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(reportModeEnabled ? Color.purple : Color.secondary)
                    .frame(width: 44, height: 44)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .accessibilityLabel(reportModeEnabled ? "Melde-Modus beenden" : "Sperrung melden")
        }
        .padding(.leading, 8)
        .padding(.top, 8)
    }

    private var statusOverlays: some View {
        VStack(spacing: 8) {
            if reportModeEnabled {
                Text("Melde-Modus: Tippe auf die gesperrte Stelle")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.purple.opacity(0.9), in: Capsule())
            }
            if tapPlanningEnabled {
                Text(planningHint)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.blue.opacity(0.9), in: Capsule())
            }
            if let recording = locationService.activeRecording {
                recordingOverlay(recording)
            }
            if let message = trackSavedMessage {
                Text(message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.green.opacity(0.9), in: Capsule())
            }
        }
        .padding(.top, 8)
        .padding(.horizontal, 60)
    }

    private var planningHint: String {
        if startCoordinate == nil {
            return "Planungsmodus: Tippe auf die Karte, um den Start zu setzen"
        }
        if destinationCoordinate == nil {
            return "Planungsmodus: Tippe auf die Karte, um das Ziel zu setzen"
        }
        return "Planungsmodus: Weitere Taps fügen Zwischenpunkte hinzu"
    }

    private func recordingOverlay(_ recording: ActiveRecording) -> some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            HStack(spacing: 12) {
                Circle()
                    .fill(.red)
                    .frame(width: 10, height: 10)
                Label(Format.distance(recording.distance), systemImage: "road.lanes")
                Label(Format.duration(recording.duration), systemImage: "timer")
                Label(Format.speedKmh(locationService.speed), systemImage: "speedometer")
            }
            .font(.footnote.weight(.semibold))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.thinMaterial, in: Capsule())
        }
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            Button {
                showPlanner = true
            } label: {
                Label("Route planen", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button {
                toggleRecording()
            } label: {
                Label(locationService.isRecording ? "Stopp" : "Aufnahme",
                      systemImage: locationService.isRecording ? "stop.circle.fill" : "record.circle")
            }
            .buttonStyle(.borderedProminent)
            .tint(locationService.isRecording ? .red : .orange)
            .controlSize(.large)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.thinMaterial)
    }

    // MARK: - Planner-Sheet

    private var plannerSheet: some View {
        RoutePlannerSheet(plannedRoute: $plannedRoute,
                          cameraPosition: $cameraPosition,
                          startCoordinate: $startCoordinate,
                          destinationCoordinate: $destinationCoordinate,
                          viaPoints: $viaPoints,
                          startText: $startText,
                          destinationText: $destinationText,
                          tapPlanningEnabled: $tapPlanningEnabled)
            .presentationDetents([.medium, .large])
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
    }

    // MARK: - Aktionen

    private func handlePlanningTap(_ tapped: CLLocationCoordinate2D) {
        let coordinate = Coordinate(tapped)
        if startCoordinate == nil {
            startCoordinate = coordinate
            startText = coordinateLabel(coordinate)
        } else if destinationCoordinate == nil {
            destinationCoordinate = coordinate
            destinationText = coordinateLabel(coordinate)
        } else {
            viaPoints.append(coordinate)
        }
    }

    private func coordinateLabel(_ c: Coordinate) -> String {
        String(format: "Kartenpunkt (%.4f, %.4f)", c.latitude, c.longitude)
    }

    private func toggleRecording() {
        if locationService.isRecording {
            if let track = locationService.stopRecording() {
                tourStore.add(track: track)
                trackSavedMessage = "Tour gespeichert: \(track.name)"
            } else {
                trackSavedMessage = "Aufzeichnung verworfen – zu wenige GPS-Punkte."
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                trackSavedMessage = nil
            }
        } else {
            locationService.startRecording()
        }
    }

    private func togglePOI(_ category: POICategory) {
        if activePOICategory == category {
            activePOICategory = nil
            poiItems = []
            return
        }
        activePOICategory = category
        poiItems = []
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = category.query
        if let region = visibleRegion {
            request.region = region
        }
        Task { @MainActor in
            let response = try? await MKLocalSearch(request: request).start()
            guard activePOICategory == category else { return }
            poiItems = response?.mapItems ?? []
        }
    }
}

// MARK: - POI-Kategorien

private enum POICategory: String, CaseIterable, Identifiable {
    case tankstelle
    case restaurant
    case hotel
    case werkstatt

    var id: String { rawValue }

    var label: String {
        switch self {
        case .tankstelle: return "Tankstelle"
        case .restaurant: return "Restaurant"
        case .hotel: return "Hotel"
        case .werkstatt: return "Werkstatt"
        }
    }

    var systemImage: String {
        switch self {
        case .tankstelle: return "fuelpump.fill"
        case .restaurant: return "fork.knife"
        case .hotel: return "bed.double.fill"
        case .werkstatt: return "wrench.and.screwdriver.fill"
        }
    }

    var query: String {
        switch self {
        case .tankstelle: return "Tankstelle"
        case .restaurant: return "Restaurant"
        case .hotel: return "Hotel"
        case .werkstatt: return "Motorrad Werkstatt"
        }
    }
}

// MARK: - Farben für Meldungsarten

private func eventColor(_ kind: ClosureEvent.Kind) -> Color {
    switch kind {
    case .sperrung: return .red
    case .baustelle: return .orange
    case .warnung: return .yellow
    }
}

// MARK: - Detail-Sheet für Verkehrsmeldungen

private struct TrafficEventDetailSheet: View {
    let event: ClosureEvent
    @Environment(\.dismiss) private var dismiss
    @Environment(TrafficNewsService.self) private var newsService

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(event.kind.rawValue, systemImage: event.kind.systemImage)
                        .foregroundStyle(eventColor(event.kind))
                        .font(.headline)
                    if !event.subtitle.isEmpty {
                        Text(event.subtitle)
                    }
                    if event.isBlocking {
                        Label("Vollsperrung", systemImage: "xmark.octagon.fill")
                            .foregroundStyle(.red)
                    }
                    LabeledContent("Straße", value: event.roadId)
                    if let date = event.startDate {
                        LabeledContent("Beginn", value: Format.shortDate(date))
                    }
                    LabeledContent("Quelle", value: event.source.label)
                }
                if !event.descriptionLines.isEmpty {
                    Section("Details") {
                        ForEach(Array(event.descriptionLines.enumerated()), id: \.offset) { _, line in
                            Text(line)
                        }
                    }
                }
                if event.source == .nutzer {
                    Section {
                        Button(role: .destructive) {
                            newsService.removeUserClosure(eventID: event.id)
                            dismiss()
                        } label: {
                            Label("Meldung löschen", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(event.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
    }
}
