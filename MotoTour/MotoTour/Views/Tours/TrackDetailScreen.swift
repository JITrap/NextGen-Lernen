import SwiftUI
import MapKit
import UIKit

/// Detailansicht einer aufgezeichneten Tour: Karte, Statistik, Umbenennen, GPX-Export, Löschen.
struct TrackDetailScreen: View {
    @Environment(TourStore.self) private var tourStore
    @Environment(AppSettings.self) private var settings
    @Environment(\.dismiss) private var dismiss

    let track: RecordedTrack

    @State private var cameraPosition: MapCameraPosition
    @State private var showingRenameAlert = false
    @State private var showingDeleteDialog = false
    @State private var newName = ""
    @State private var exportURL: URL?

    init(track: RecordedTrack) {
        self.track = track
        _cameraPosition = State(initialValue: .region(Self.region(for: track.clCoordinates)))
        _newName = State(initialValue: track.name)
    }

    /// Aktueller Stand aus dem Store (z. B. nach Umbenennen).
    private var currentTrack: RecordedTrack {
        tourStore.tracks.first(where: { $0.id == track.id }) ?? track
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                trackMap

                statisticsGrid
                    .padding(.horizontal)

                actionButtons
                    .padding(.horizontal)
            }
            .padding(.bottom, 24)
        }
        .navigationTitle(currentTrack.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: currentTrack.name) {
            exportURL = tourStore.exportURL(for: currentTrack)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        newName = currentTrack.name
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
        .alert("Tour umbenennen", isPresented: $showingRenameAlert) {
            TextField("Name", text: $newName)
            Button("Speichern") {
                let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    tourStore.rename(track: currentTrack, to: trimmed)
                }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Neuen Namen für diese Tour eingeben.")
        }
        .confirmationDialog("Tour löschen?", isPresented: $showingDeleteDialog, titleVisibility: .visible) {
            Button("Löschen", role: .destructive) {
                tourStore.delete(track: currentTrack)
                dismiss()
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Diese Tour wird dauerhaft entfernt.")
        }
    }

    // MARK: - Karte

    private var trackMap: some View {
        Map(position: $cameraPosition) {
            MapPolyline(coordinates: track.clCoordinates)
                .stroke(.blue, lineWidth: 4)
            if let start = track.clCoordinates.first {
                Marker("Start", systemImage: "flag.fill", coordinate: start)
                    .tint(.green)
            }
            if track.clCoordinates.count > 1, let end = track.clCoordinates.last {
                Marker("Ende", systemImage: "flag.checkered", coordinate: end)
                    .tint(.red)
            }
        }
        .mapStyle(settings.mapStyleOption.mapStyle)
        .mapControls {
            MapCompass()
            MapScaleView()
        }
        .frame(height: 300)
    }

    // MARK: - Statistik

    private var statisticsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            TrackStatTile(title: "Distanz",
                          value: Format.distance(currentTrack.distance),
                          systemImage: "road.lanes")
            TrackStatTile(title: "Fahrzeit",
                          value: Format.duration(currentTrack.duration),
                          systemImage: "clock")
            TrackStatTile(title: "Ø-Geschwindigkeit",
                          value: Format.speedKmh(currentTrack.averageSpeed),
                          systemImage: "gauge.with.needle")
            TrackStatTile(title: "Max",
                          value: Format.speedKmh(currentTrack.maxSpeed),
                          systemImage: "speedometer")
            TrackStatTile(title: "Höhenmeter",
                          value: String(format: "%.0f m", currentTrack.ascent),
                          systemImage: "mountain.2.fill")
            TrackStatTile(title: "Zeitraum",
                          value: "\(Format.shortDate(currentTrack.startedAt)) – \(Format.shortDate(currentTrack.endedAt))",
                          systemImage: "calendar")
        }
    }

    // MARK: - Aktionen

    private var actionButtons: some View {
        VStack(spacing: 10) {
            if let url = exportURL {
                ShareLink(item: url) {
                    Label("GPX teilen", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            Button {
                newName = currentTrack.name
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

// MARK: - Statistik-Kachel

private struct TrackStatTile: View {
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
