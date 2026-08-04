import SwiftUI
import UIKit

/// Gesamtstatistik über alle aufgezeichneten Touren, inkl. Kilometer pro Jahr.
struct StatisticsView: View {
    @Environment(TourStore.self) private var tourStore

    var body: some View {
        if tourStore.tracks.isEmpty {
            ContentUnavailableView(
                "Noch keine Statistik",
                systemImage: "chart.bar.xaxis",
                description: Text("Zeichne deine erste Tour auf, dann erscheinen hier deine Kennzahlen.")
            )
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    statTiles
                    yearSection
                }
                .padding()
            }
        }
    }

    // MARK: - Kennzahlen-Kacheln

    private var statTiles: some View {
        let stats = tourStore.statistics
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            SummaryTile(title: "Anzahl Touren",
                        value: "\(stats.tourCount)",
                        systemImage: "number")
            SummaryTile(title: "Gesamt-Distanz",
                        value: Format.distance(stats.totalDistance),
                        systemImage: "road.lanes")
            SummaryTile(title: "Gesamt-Fahrzeit",
                        value: Format.duration(stats.totalDuration),
                        systemImage: "clock")
            SummaryTile(title: "Höchstgeschwindigkeit",
                        value: Format.speedKmh(stats.maxSpeed),
                        systemImage: "speedometer")
            SummaryTile(title: "Höhenmeter gesamt",
                        value: String(format: "%.0f m", stats.totalAscent),
                        systemImage: "mountain.2.fill")
            SummaryTile(title: "Längste Tour",
                        value: Format.distance(stats.longestTourDistance),
                        systemImage: "trophy.fill")
        }
    }

    // MARK: - Kilometer pro Jahr

    private var yearSection: some View {
        let byYear = tourStore.distanceByYear
        let maxDistance = max(byYear.map(\.distance).max() ?? 0, 1)
        return VStack(alignment: .leading, spacing: 12) {
            Text("Kilometer pro Jahr")
                .font(.headline)
            ForEach(byYear, id: \.year) { entry in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(String(entry.year))
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(Format.distance(entry.distance))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color(uiColor: .secondarySystemBackground))
                            Capsule()
                                .fill(Color.blue.gradient)
                                .frame(width: max(8, geo.size.width * entry.distance / maxDistance))
                        }
                    }
                    .frame(height: 10)
                }
            }
        }
        .padding(14)
        .background(Color(uiColor: .secondarySystemBackground).opacity(0.5),
                    in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Kachel

private struct SummaryTile: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
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
