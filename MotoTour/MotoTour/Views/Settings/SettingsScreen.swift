import SwiftUI
import CoreLocation
import UIKit

/// Einstellungs-Bildschirm: Karte, Routenplanung, Navigation/Sperrungen,
/// Standort-Berechtigung und Infos über die App.
struct SettingsScreen: View {
    @Environment(AppSettings.self) private var settings
    @Environment(LocationService.self) private var locationService

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    private var authorizationText: String {
        switch locationService.authorization {
        case .authorizedAlways:
            return "Erlaubt (immer)"
        case .authorizedWhenInUse:
            return "Nur während der Nutzung"
        case .denied, .restricted:
            return "Verweigert"
        case .notDetermined:
            return "Nicht festgelegt"
        @unknown default:
            return "Unbekannt"
        }
    }

    var body: some View {
        @Bindable var settings = settings

        NavigationStack {
            Form {
                Section("Karte") {
                    Picker("Kartenstil", selection: $settings.mapStyleOption) {
                        ForEach(MapStyleOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                }

                Section("Routenplanung") {
                    Toggle("Autobahnen vermeiden", isOn: $settings.avoidHighways)
                    Toggle("Mautstraßen vermeiden", isOn: $settings.avoidTolls)
                }

                Section {
                    Toggle("Route bei neuen Sperrungen automatisch anpassen",
                           isOn: $settings.autoRerouteOnClosures)
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Sperrungs-Abstand")
                            Spacer()
                            Text(Format.distance(settings.closureRouteThreshold))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        Slider(value: $settings.closureRouteThreshold,
                               in: 200...2000,
                               step: 100) {
                            Text("Sperrungs-Abstand")
                        } minimumValueLabel: {
                            Text(Format.distance(200)).font(.caption2)
                        } maximumValueLabel: {
                            Text(Format.distance(2000)).font(.caption2)
                        }
                    }
                    Toggle("Display während Navigation anlassen",
                           isOn: $settings.keepScreenOn)
                } header: {
                    Text("Navigation & Sperrungen")
                } footer: {
                    Text("Ab diesem Abstand gilt eine Meldung als auf der Route")
                }

                Section("Standort") {
                    HStack {
                        Text("Berechtigung")
                        Spacer()
                        Text(authorizationText)
                            .foregroundStyle(.secondary)
                    }
                    Button("Standort-Einstellungen öffnen") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }

                Section("Über MotoTour") {
                    Label("100 % kostenlos – keine Abos, keine Konten, keine Werbung",
                          systemImage: "heart.fill")
                    Label("Routing & Karten: Apple Karten",
                          systemImage: "map")
                    Label("Verkehrsmeldungen Autobahn: Autobahn GmbH des Bundes (autobahn.de)",
                          systemImage: "exclamationmark.triangle")
                    Label("Landstraßen-Sperrungen & Baustellen: © OpenStreetMap-Mitwirkende",
                          systemImage: "road.lanes.curved.right")
                    Label("Deine Touren bleiben nur auf deinem Gerät",
                          systemImage: "lock.shield")
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Einstellungen")
        }
    }
}

#Preview {
    SettingsScreen()
        .environment(AppSettings())
        .environment(LocationService())
}
