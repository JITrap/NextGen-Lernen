import SwiftUI
import MapKit
import CoreLocation

/// Textfeld mit Ortssuche über MKLocalSearchCompleter.
/// Die Auswahl eines Vorschlags löst eine MKLocalSearch aus und schreibt die
/// gefundene Koordinate in das Binding.
struct PlaceSearchField: View {
    let title: String
    @Binding var text: String
    @Binding var coordinate: Coordinate?

    @State private var completer = PlaceSearchCompleter()
    @State private var isResolving = false
    @State private var suppressSearch = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                TextField(title, text: $text)
                    .focused($isFocused)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.words)
                if isResolving {
                    ProgressView()
                } else if coordinate != nil {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }
            if isFocused && !completer.results.isEmpty {
                ForEach(Array(completer.results.prefix(5).enumerated()), id: \.offset) { _, completion in
                    Button {
                        select(completion)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(completion.title)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                            if !completion.subtitle.isEmpty {
                                Text(completion.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .onChange(of: text) { _, newValue in
            if suppressSearch {
                suppressSearch = false
                return
            }
            guard isFocused else { return }
            coordinate = nil
            completer.update(query: newValue)
        }
    }

    private func select(_ completion: MKLocalSearchCompletion) {
        isFocused = false
        completer.clear()
        suppressSearch = true
        text = completion.subtitle.isEmpty
            ? completion.title
            : "\(completion.title), \(completion.subtitle)"
        isResolving = true
        Task { @MainActor in
            defer { isResolving = false }
            let request = MKLocalSearch.Request(completion: completion)
            if let item = try? await MKLocalSearch(request: request).start().mapItems.first {
                coordinate = Coordinate(item.placemark.coordinate)
            }
        }
    }
}

/// Kleiner @Observable-Wrapper um MKLocalSearchCompleter.
@Observable
final class PlaceSearchCompleter: NSObject, MKLocalSearchCompleterDelegate {
    private(set) var results: [MKLocalSearchCompletion] = []

    @ObservationIgnored private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    func update(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            completer.cancel()
            results = []
            return
        }
        completer.queryFragment = trimmed
    }

    func clear() {
        completer.cancel()
        results = []
    }

    // MARK: - MKLocalSearchCompleterDelegate

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        results = []
    }
}
