import Foundation
import SwiftUI
import MapKit

enum MapStyleOption: String, Codable, CaseIterable, Identifiable {
    case standard
    case hybrid
    case satellit

    var id: String { rawValue }

    var label: String {
        switch self {
        case .standard: return "Standard"
        case .hybrid: return "Hybrid"
        case .satellit: return "Satellit"
        }
    }

    var mapStyle: MapStyle {
        switch self {
        case .standard: return .standard(elevation: .realistic)
        case .hybrid: return .hybrid(elevation: .realistic)
        case .satellit: return .imagery(elevation: .realistic)
        }
    }
}

/// App-Einstellungen, in UserDefaults persistiert. Alles kostenlos, kein Konto nötig.
@Observable
final class AppSettings {
    var avoidHighways: Bool {
        didSet { UserDefaults.standard.set(avoidHighways, forKey: "avoidHighways") }
    }
    var avoidTolls: Bool {
        didSet { UserDefaults.standard.set(avoidTolls, forKey: "avoidTolls") }
    }
    var mapStyleOption: MapStyleOption {
        didSet { UserDefaults.standard.set(mapStyleOption.rawValue, forKey: "mapStyleOption") }
    }
    /// Route bei neuen Sperrungen automatisch anpassen (während der Navigation).
    var autoRerouteOnClosures: Bool {
        didSet { UserDefaults.standard.set(autoRerouteOnClosures, forKey: "autoRerouteOnClosures") }
    }
    /// Abstand in Metern, ab dem eine Meldung als "auf der Route" gilt.
    var closureRouteThreshold: Double {
        didSet { UserDefaults.standard.set(closureRouteThreshold, forKey: "closureRouteThreshold") }
    }
    /// Bildschirm während der Navigation anlassen.
    var keepScreenOn: Bool {
        didSet { UserDefaults.standard.set(keepScreenOn, forKey: "keepScreenOn") }
    }

    init() {
        let d = UserDefaults.standard
        self.avoidHighways = d.object(forKey: "avoidHighways") as? Bool ?? false
        self.avoidTolls = d.object(forKey: "avoidTolls") as? Bool ?? false
        self.mapStyleOption = MapStyleOption(rawValue: d.string(forKey: "mapStyleOption") ?? "") ?? .standard
        self.autoRerouteOnClosures = d.object(forKey: "autoRerouteOnClosures") as? Bool ?? true
        self.closureRouteThreshold = d.object(forKey: "closureRouteThreshold") as? Double ?? 500
        self.keepScreenOn = d.object(forKey: "keepScreenOn") as? Bool ?? true
    }
}
