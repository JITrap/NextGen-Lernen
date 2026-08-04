import SwiftUI

/// Übersicht aller aktuellen Verkehrsmeldungen (Sperrungen, Baustellen, Warnungen)
/// von der kostenlosen Autobahn-API des Bundes.
struct NewsScreen: View {
    @Environment(TrafficNewsService.self) private var newsService

    private enum NewsFilter: String, CaseIterable, Identifiable {
        case alle = "Alle"
        case sperrungen = "Sperrungen"
        case baustellen = "Baustellen"

        var id: String { rawValue }
    }

    @State private var filter: NewsFilter = .alle
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Verkehrsmeldungen")
                .searchable(text: $searchText, prompt: "Straße oder Titel")
                .task { await newsService.refresh() }
        }
    }

    // MARK: - Inhalt

    @ViewBuilder
    private var content: some View {
        if newsService.isLoading && newsService.events.isEmpty {
            ProgressView("Lade Meldungen …")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 0) {
                Picker("Filter", selection: $filter) {
                    ForEach(NewsFilter.allCases) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                eventList
            }
        }
    }

    private var eventList: some View {
        List {
            if let error = newsService.lastError {
                Section {
                    errorBox(error)
                }
            }

            Section {
                ForEach(filteredEvents) { event in
                    NavigationLink {
                        NewsDetailScreen(event: event)
                    } label: {
                        row(for: event)
                    }
                }
            } footer: {
                footerView
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await newsService.refresh(force: true)
        }
        .overlay {
            if filteredEvents.isEmpty && !newsService.isLoading && newsService.lastError == nil {
                ContentUnavailableView(
                    "Keine Meldungen",
                    systemImage: "checkmark.circle",
                    description: Text("Aktuell liegen keine passenden Verkehrsmeldungen vor.")
                )
            }
        }
    }

    // MARK: - Zeile

    private func row(for event: ClosureEvent) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: event.kind.systemImage)
                .font(.title3)
                .foregroundStyle(color(for: event.kind))
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(event.roadId)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.blue, in: Capsule())

                    if let start = event.startDate {
                        Text(Format.shortDate(start))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Text(event.title)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)

                Text(event.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Fehler & Fußzeile

    private func errorBox(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(message, systemImage: "wifi.exclamationmark")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Button {
                Task { await newsService.refresh(force: true) }
            } label: {
                Label("Erneut versuchen", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.vertical, 4)
    }

    private var footerView: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let updated = newsService.lastUpdated {
                Text("Stand: \(Format.shortDate(updated))")
            }
            Text("Daten: Autobahn GmbH des Bundes (kostenlos)")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(.top, 4)
    }

    // MARK: - Filter & Farben

    private var filteredEvents: [ClosureEvent] {
        var result = newsService.events
        switch filter {
        case .alle:
            break
        case .sperrungen:
            result = result.filter { $0.kind == .sperrung }
        case .baustellen:
            result = result.filter { $0.kind == .baustelle }
        }
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return result }
        return result.filter { event in
            event.roadId.localizedCaseInsensitiveContains(query)
                || event.title.localizedCaseInsensitiveContains(query)
        }
    }

    private func color(for kind: ClosureEvent.Kind) -> Color {
        switch kind {
        case .sperrung: return .red
        case .baustelle: return .orange
        case .warnung: return .yellow
        }
    }
}
