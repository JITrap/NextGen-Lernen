import SwiftUI
import UniformTypeIdentifiers

/// Touren-Bibliothek: aufgezeichnete Touren, geplante Routen und Gesamtstatistik.
struct ToursScreen: View {
    @Environment(TourStore.self) private var tourStore

    @State private var selectedTab: ToursTab = .aufgezeichnet
    @State private var showingImporter = false
    @State private var showingImportAlert = false
    @State private var importMessage = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Bereich", selection: $selectedTab) {
                    ForEach(ToursTab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.top, 8)

                switch selectedTab {
                case .aufgezeichnet:
                    recordedList
                case .geplant:
                    plannedList
                case .statistik:
                    StatisticsView()
                }
            }
            .navigationTitle("Meine Touren")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if selectedTab == .aufgezeichnet {
                        Button {
                            showingImporter = true
                        } label: {
                            Label("GPX importieren", systemImage: "square.and.arrow.down")
                        }
                    }
                }
            }
            .fileImporter(isPresented: $showingImporter,
                          allowedContentTypes: Self.gpxTypes) { result in
                handleImport(result)
            }
            .alert("GPX-Import", isPresented: $showingImportAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(importMessage)
            }
        }
    }

    // MARK: - Aufgezeichnete Touren

    private var recordedList: some View {
        Group {
            if tourStore.tracks.isEmpty {
                ContentUnavailableView(
                    "Keine Touren aufgezeichnet",
                    systemImage: "point.bottomleft.forward.to.point.topright.scurvepath",
                    description: Text("Starte die Aufzeichnung auf der Karte oder importiere eine GPX-Datei über den Knopf oben rechts.")
                )
            } else {
                List {
                    ForEach(tourStore.tracks) { track in
                        NavigationLink {
                            TrackDetailScreen(track: track)
                        } label: {
                            TrackRow(track: track)
                        }
                    }
                    .onDelete(perform: deleteTracks)
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    private func deleteTracks(at offsets: IndexSet) {
        let toDelete = offsets.map { tourStore.tracks[$0] }
        for track in toDelete {
            tourStore.delete(track: track)
        }
    }

    // MARK: - Geplante Routen

    private var plannedList: some View {
        Group {
            if tourStore.routes.isEmpty {
                ContentUnavailableView(
                    "Keine geplanten Routen",
                    systemImage: "map",
                    description: Text("Plane eine Route auf der Karte und speichere sie, um sie hier wiederzufinden.")
                )
            } else {
                List {
                    ForEach(tourStore.routes) { route in
                        NavigationLink {
                            RouteDetailScreen(route: route)
                        } label: {
                            RouteRow(route: route)
                        }
                    }
                    .onDelete(perform: deleteRoutes)
                }
                .listStyle(.insetGrouped)
            }
        }
    }

    private func deleteRoutes(at offsets: IndexSet) {
        let toDelete = offsets.map { tourStore.routes[$0] }
        for route in toDelete {
            tourStore.delete(route: route)
        }
    }

    // MARK: - GPX-Import

    private static var gpxTypes: [UTType] {
        var types: [UTType] = []
        if let gpx = UTType(filenameExtension: "gpx") {
            types.append(gpx)
        }
        types.append(.xml)
        return types
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            let secured = url.startAccessingSecurityScopedResource()
            defer {
                if secured { url.stopAccessingSecurityScopedResource() }
            }
            do {
                let data = try Data(contentsOf: url)
                let name = url.deletingPathExtension().lastPathComponent
                switch tourStore.importGPX(data: data, suggestedName: name) {
                case .track(let track):
                    importMessage = "„\(track.name)“ wurde importiert (\(Format.distance(track.distance)))."
                    selectedTab = .aufgezeichnet
                case .failed(let message):
                    importMessage = message
                }
            } catch {
                importMessage = "Die Datei konnte nicht gelesen werden: \(error.localizedDescription)"
            }
        case .failure(let error):
            importMessage = "Import fehlgeschlagen: \(error.localizedDescription)"
        }
        showingImportAlert = true
    }
}

// MARK: - Tabs

private enum ToursTab: String, CaseIterable, Identifiable {
    case aufgezeichnet = "Aufgezeichnet"
    case geplant = "Geplant"
    case statistik = "Statistik"

    var id: String { rawValue }
}

// MARK: - Zeilen

private struct TrackRow: View {
    let track: RecordedTrack

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(track.name)
                .font(.headline)
                .lineLimit(1)
            Text(Format.shortDate(track.startedAt))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Label(Format.distance(track.distance), systemImage: "road.lanes")
                Label(Format.duration(track.duration), systemImage: "clock")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

private struct RouteRow: View {
    let route: PlannedRoute

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(route.name)
                .font(.headline)
                .lineLimit(1)
            Label(route.profile.label, systemImage: route.profile.systemImage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Label(Format.distance(route.distance), systemImage: "road.lanes")
                Label(Format.duration(route.expectedTravelTime), systemImage: "clock")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
