import Foundation
import CoreLocation

/// Laufende Tour-Aufzeichnung mit Live-Statistik.
struct ActiveRecording {
    var startedAt: Date = Date()
    var points: [TrackPoint] = []
    var distance: Double = 0        // Meter
    var maxSpeed: Double = 0        // m/s
    var ascent: Double = 0          // Höhenmeter

    var duration: TimeInterval { Date().timeIntervalSince(startedAt) }
    var averageSpeed: Double { duration > 1 ? distance / duration : 0 }
}

/// GPS-Standort, Berechtigungen und Tour-Aufzeichnung.
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    private(set) var authorization: CLAuthorizationStatus = .notDetermined
    private(set) var currentLocation: CLLocation?
    /// Fahrtrichtung in Grad (aus GPS-Kurs), nil wenn unbekannt.
    private(set) var course: Double?
    private(set) var activeRecording: ActiveRecording?

    var isRecording: Bool { activeRecording != nil }
    var speed: Double { max(0, currentLocation?.speed ?? 0) }

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.activityType = .automotiveNavigation
        authorization = manager.authorizationStatus
    }

    // MARK: - Steuerung

    func requestPermission() {
        if authorization == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }

    func startUpdating() {
        requestPermission()
        manager.startUpdatingLocation()
    }

    func stopUpdating() {
        if !isRecording {
            manager.stopUpdatingLocation()
        }
    }

    /// Hintergrund-Updates für Navigation/Aufzeichnung aktivieren bzw. deaktivieren.
    func setContinuousMode(_ on: Bool) {
        if on {
            if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
                manager.allowsBackgroundLocationUpdates = true
                manager.pausesLocationUpdatesAutomatically = false
                manager.showsBackgroundLocationIndicator = true
            }
            manager.startUpdatingLocation()
        } else {
            manager.allowsBackgroundLocationUpdates = false
            manager.pausesLocationUpdatesAutomatically = true
        }
    }

    // MARK: - Aufzeichnung

    func startRecording() {
        guard !isRecording else { return }
        activeRecording = ActiveRecording()
        setContinuousMode(true)
    }

    /// Beendet die Aufzeichnung und liefert die fertige Tour (nil bei zu wenigen Punkten).
    func stopRecording() -> RecordedTrack? {
        guard let recording = activeRecording else { return nil }
        activeRecording = nil
        setContinuousMode(false)

        guard recording.points.count >= 2 else { return nil }
        let ended = recording.points.last?.timestamp ?? Date()
        let duration = ended.timeIntervalSince(recording.startedAt)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "d. MMMM yyyy"
        return RecordedTrack(name: "Tour vom \(formatter.string(from: recording.startedAt))",
                             startedAt: recording.startedAt,
                             endedAt: ended,
                             points: recording.points,
                             distance: recording.distance,
                             duration: max(duration, 1),
                             maxSpeed: recording.maxSpeed,
                             averageSpeed: duration > 1 ? recording.distance / duration : 0,
                             ascent: recording.ascent)
    }

    // MARK: - CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorization = manager.authorizationStatus
        if authorization == .authorizedWhenInUse || authorization == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        guard location.horizontalAccuracy >= 0, location.horizontalAccuracy < 100 else { return }

        currentLocation = location
        if location.course >= 0 {
            course = location.course
        }

        guard var recording = activeRecording else { return }
        let point = TrackPoint(location: location)
        if let last = recording.points.last {
            let delta = Geo.distance(last.cl, point.cl)
            // Stillstand und GPS-Sprünge herausfiltern.
            if delta >= 3 {
                recording.distance += delta
                if point.altitude > last.altitude {
                    recording.ascent += point.altitude - last.altitude
                }
                recording.points.append(point)
            }
        } else {
            recording.points.append(point)
        }
        if location.speed > recording.maxSpeed {
            recording.maxSpeed = location.speed
        }
        activeRecording = recording
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // GPS-Aussetzer sind normal (Tunnel etc.) – bewusst ignorieren.
    }
}
