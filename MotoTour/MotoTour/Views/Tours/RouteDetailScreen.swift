import SwiftUI
import MapKit
import UIKit

/// Detailansicht einer geplanten Route: Karte, Kennzahlen, Warnungen,
/// Navigation starten, GPX-Export, Umbenennen, Löschen.
struct RouteDetailScreen: View {
    @Environment(TourStore.self) private var tourStore
    @Environment(NavigationEngine.self) private var navigationEngine
    @Environment(LocationService.self) private var locationService
    @Environment(RoutingService.self) private var routing
    @Environment(TrafficNewsService.self) private var newsService
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    let route: PlannedRoute

    @State private var cameraPosition: MapCameraPosition
    @State private var showingRenameAlert = false
    @State private var showingDeleteDialog = false
    @State private var newName = ""
    @State private var exportURL: URL?

    init(route: PlannedRoute) {
        self.route = route
        _cameraPosition = State(initialValue: .region(Self.region(for: route.clCoordinates)))
        _newName = State(initialValue: route.name)
    }

    /// Aktueller Stand aus dem Store (z. B. nach Umbenennen).
    private var currentRoute: PlannedRoute {
        tourStore.routes.first(where: { $0.id == route.id }) ?? route
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                routeMap

                infoGrid
                    .padding(.horizontal)

                if !currentRoute.warnings.isEmpty {
                    warningsSection
                        .padding(.horizontal)
                }

                actionButtons
                    .padding(.horizontal)
            }
            .padding(.bottom, 24)
        }
        .navigationTitle(currentRoute.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: currentRoute.name) {
            exportURL = tourStore.exportURL(for: currentRoute)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        newName = currentRoute.name
                        showingRenameAlert = true
                    } label: {
                        Label("Umbenennen", systemImage: "pencil")
                    }
                    if let url = exportURL {
                        ShareLink(item: url) {
                            Label("GPX teilen", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button(role: .destructive) {
                        showingDeleteDialog = true
                    } label: {
                        Label("Löschen", systemImage: "trash")
                    }
                } label: {
                    Label("Aktionen", systemImage: "ellipsis.circle")
                }
            }
        }
        .alert("Route umbenennen", isPresented: $showingRenameAlert) {
            TextField("Name", text: $newName)
            Button("Speichern") {
                let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    tourStore.rename(route: currentRoute, to: trimmed)
                }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Neuen Namen für diese Route eingeben.")
        }
        .confirmationDialog("Route löschen?", isPresented: $showingDeleteDialog, titleVisibility: .visible) {
            Button("Löschen", role: .destructive) {
                tourStore.delete(route: currentRoute)
                dismiss()
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Diese Route wird dauerhaft entfernt.")
        }
    }

    // MARK: - Karte

    private var routeMap: some View {
        Map(position: $cameraPosition) {
            MapPolyline(coordinates: route.clCoordinates)
                .stroke(.blue, lineWidth: 4)
            Marker("Start", systemImage: "flag.fill", coordinate: route.start.cl)
                .tint(.green)
            Marker("Ziel", systemImage: "flag.checkered", coordinate: route.destination.cl)
                .tint(.red)
            ForEach(Array(route.viaPoints.enumerated()), id: \.offset) { index, via in
                Marker("Via \(index + 1)", systemImage: "mappin", coordinate: via.cl)
                    .tint(.orange)
            }
        }
        .mapStyle(settings.mapStyleOption.mapStyle)
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .frame(height: 300)
    }

    // MARK: - Kennzahlen

    private var infoGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            RouteStatTile(title: "Profil",
                          value: currentRoute.profile.label,
                          systemImage: currentRoute.profile.systemImage)
            RouteStatTile(title: "Distanz",
                          value: Format.distance(currentRoute.distance),
                          systemImage: "road.lanes")
            RouteStatTile(title: "Fahrzeit",
                          value: Format.duration(currentRoute.expectedTravelTime),
                          systemImage: "clock")
            RouteStatTile(title: "Kurvigkeit",
                          value: String(format: "%.0f Grad/km", currentRoute.curvinessScore),
                          systemImage: "point.topleft.down.curvedto.point.bottomright.up")
        }
    }

    // MARK: - Warnungen

    private var warningsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(currentRoute.warnings, id: \.self) { warning in
                Label(warning, systemImage: "exclamationmark.triangle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.orange.opacity(0.12),
                                in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: - Aktionen

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                navigationEngine.start(route: currentRoute,
                                       locationService: locationService,
                                       routing: routing,
                                       news: newsService,
                                       settings: settings)
            } label: {
                Label("Navigation starten", systemImage: "location.north.line.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            if let url = exportURL {
                ShareLink(item: url) {
                    Label("GPX teilen", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            Button {
                newName = currentRoute.name
                showingRenameAlert = true
            } label: {
                Label("Umbenennen", systemImage: "pencil")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            Button(role: .destructive) {
                showingDeleteDialog = true
            } label: {
                Label("Löschen", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Kamera-Region

    private static func region(for coords: [CLLocationCoordinate2D]) -> MKCoordinateRegion {
        guard let first = coords.first else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 51.163, longitude: 10.447),
                span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 8)
            )
        }
        var minLat = first.latitude
        var maxLat = first.latitude
        var minLon = first.longitude
        var maxLon = first.longitude
        for c in coords {
            minLat = min(minLat, c.latitude)
            maxLat = max(maxLat, c.latitude)
            minLon = min(minLon, c.longitude)
            maxLon = max(maxLon, c.longitude)
        }
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2,
                                            longitude: (minLon + maxLon) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.4, 0.01),
                                    longitudeDelta: max((maxLon - minLon) * 1.4, 0.01))
        return MKCoordinateRegion(center: center, span: span)
    }
}

// MARK: - Kennzahlen-Kachel

private struct RouteStatTile: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(value)
                .font(.headline)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(uiColor: .secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 12))
    }
}
