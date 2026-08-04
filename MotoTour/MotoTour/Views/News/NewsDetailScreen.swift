import SwiftUI
import MapKit
import CoreLocation

/// Detailansicht einer einzelnen Verkehrsmeldung.
struct NewsDetailScreen: View {
    let event: ClosureEvent

    @Environment(AppSettings.self) private var settings

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if event.isBlocking {
                    blockingHint
                }

                if let start = event.startDate {
                    Label("Beginn: \(Format.shortDate(start))", systemImage: "calendar")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if !event.descriptionLines.isEmpty {
                    descriptionSection
                }

                if let coordinate = event.coordinate {
                    mapSection(coordinate: coordinate)
                }
            }
            .padding()
        }
        .navigationTitle(event.roadId)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Kopfbereich

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(event.roadId)
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.blue, in: Capsule())

                Text(event.kind.rawValue)
                    .font(.caption.bold())
                    .foregroundStyle(kindColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(kindColor.opacity(0.18), in: Capsule())
            }

            Text(event.title)
                .font(.title2.bold())

            if !event.subtitle.isEmpty {
                Text(event.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Vollsperrungs-Hinweis

    private var blockingHint: some View {
        Label("Vollsperrung – wird bei der Routenplanung automatisch umfahren",
              systemImage: "xmark.octagon.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Beschreibung

    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Details")
                .font(.headline)

            ForEach(Array(event.descriptionLines.enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Karte

    private func mapSection(coordinate: Coordinate) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Ort")
                .font(.headline)

            Map(initialPosition: .region(
                MKCoordinateRegion(
                    center: coordinate.cl,
                    span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
                )
            )) {
                Marker(event.roadId, systemImage: event.kind.systemImage, coordinate: coordinate.cl)
                    .tint(kindColor)
            }
            .mapStyle(settings.mapStyleOption.mapStyle)
            .frame(height: 250)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Farbe

    private var kindColor: Color {
        switch event.kind {
        case .sperrung: return .red
        case .baustelle: return .orange
        case .warnung: return .yellow
        }
    }
}
