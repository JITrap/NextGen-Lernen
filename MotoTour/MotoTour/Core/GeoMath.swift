import Foundation
import CoreLocation

/// Geometrie-Helfer für Routenberechnung, Kurvigkeit und Abstandsprüfungen.
enum Geo {
    static let earthRadius: Double = 6_371_000

    /// Distanz zwischen zwei Koordinaten in Metern (Haversine).
    static func distance(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * earthRadius * asin(min(1, sqrt(h)))
    }

    /// Kurs von `from` nach `to` in Grad (0…360, 0 = Nord).
    static func bearing(from: CLLocationCoordinate2D, to: CLLocationCoordinate2D) -> Double {
        let lat1 = from.latitude * .pi / 180
        let lat2 = to.latitude * .pi / 180
        let dLon = (to.longitude - from.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        let deg = atan2(y, x) * 180 / .pi
        return (deg + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Koordinate, die `distanceMeters` in Richtung `bearingDegrees` versetzt liegt.
    static func offset(_ c: CLLocationCoordinate2D, distanceMeters: Double, bearingDegrees: Double) -> CLLocationCoordinate2D {
        let delta = distanceMeters / earthRadius
        let theta = bearingDegrees * .pi / 180
        let lat1 = c.latitude * .pi / 180
        let lon1 = c.longitude * .pi / 180
        let lat2 = asin(sin(lat1) * cos(delta) + cos(lat1) * sin(delta) * cos(theta))
        let lon2 = lon1 + atan2(sin(theta) * sin(delta) * cos(lat1), cos(delta) - sin(lat1) * sin(lat2))
        return CLLocationCoordinate2D(latitude: lat2 * 180 / .pi, longitude: lon2 * 180 / .pi)
    }

    /// Gesamtlänge eines Pfads in Metern.
    static func pathLength(_ coords: [CLLocationCoordinate2D]) -> Double {
        guard coords.count > 1 else { return 0 }
        var total = 0.0
        for i in 1..<coords.count {
            total += distance(coords[i - 1], coords[i])
        }
        return total
    }

    /// Minimaler Abstand eines Punkts zu einer Polyline in Metern (Segment-Projektion, lokal planar genähert).
    static func distanceToPath(point: CLLocationCoordinate2D, path: [CLLocationCoordinate2D]) -> Double {
        guard !path.isEmpty else { return .greatestFiniteMagnitude }
        guard path.count > 1 else { return distance(point, path[0]) }
        var best = Double.greatestFiniteMagnitude
        let cosLat = cos(point.latitude * .pi / 180)
        func toXY(_ c: CLLocationCoordinate2D) -> (x: Double, y: Double) {
            (x: c.longitude * cosLat * 111_320, y: c.latitude * 110_540)
        }
        let p = toXY(point)
        for i in 1..<path.count {
            let a = toXY(path[i - 1])
            let b = toXY(path[i])
            let abx = b.x - a.x, aby = b.y - a.y
            let apx = p.x - a.x, apy = p.y - a.y
            let lenSq = abx * abx + aby * aby
            let t = lenSq > 0 ? max(0, min(1, (apx * abx + apy * aby) / lenSq)) : 0
            let cx = a.x + t * abx, cy = a.y + t * aby
            let dx = p.x - cx, dy = p.y - cy
            best = min(best, sqrt(dx * dx + dy * dy))
        }
        return best
    }

    /// Index des Polyline-Punkts, der `point` am nächsten liegt.
    static func closestPointIndex(on path: [CLLocationCoordinate2D], to point: CLLocationCoordinate2D) -> Int {
        var bestIndex = 0
        var best = Double.greatestFiniteMagnitude
        for (i, c) in path.enumerated() {
            let d = distance(c, point)
            if d < best {
                best = d
                bestIndex = i
            }
        }
        return bestIndex
    }

    /// Kurvigkeit: Summe der absoluten Richtungsänderungen (Grad) pro Kilometer.
    /// Die Polyline wird auf ~100-m-Abschnitte ausgedünnt, damit GPS-/Polyline-Rauschen nicht zählt.
    static func curviness(of coords: [CLLocationCoordinate2D]) -> Double {
        let resampled = thin(coords, minSpacing: 100)
        guard resampled.count > 2 else { return 0 }
        var totalTurn = 0.0
        for i in 2..<resampled.count {
            let b1 = bearing(from: resampled[i - 2], to: resampled[i - 1])
            let b2 = bearing(from: resampled[i - 1], to: resampled[i])
            var diff = abs(b2 - b1)
            if diff > 180 { diff = 360 - diff }
            totalTurn += diff
        }
        let lengthKm = pathLength(resampled) / 1000
        return lengthKm > 0.1 ? totalTurn / lengthKm : 0
    }

    /// Dünnt eine Polyline aus, sodass aufeinanderfolgende Punkte mindestens `minSpacing` Meter auseinanderliegen.
    static func thin(_ coords: [CLLocationCoordinate2D], minSpacing: Double) -> [CLLocationCoordinate2D] {
        guard let first = coords.first else { return [] }
        var result = [first]
        for c in coords.dropFirst() {
            if distance(result[result.count - 1], c) >= minSpacing {
                result.append(c)
            }
        }
        if coords.count > 1, let last = coords.last,
           distance(result[result.count - 1], last) > 1 {
            result.append(last)
        }
        return result
    }
}

/// Formatierung für deutsche Anzeige (km, km/h, Dauer).
enum Format {
    static func distance(_ meters: Double) -> String {
        if meters < 1000 {
            return String(format: "%.0f m", meters)
        }
        return String(format: "%.1f km", meters / 1000).replacingOccurrences(of: ".", with: ",")
    }

    static func speedKmh(_ metersPerSecond: Double) -> String {
        let kmh = max(0, metersPerSecond) * 3.6
        return String(format: "%.0f km/h", kmh)
    }

    static func duration(_ seconds: TimeInterval) -> String {
        let total = Int(max(0, seconds))
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 {
            return "\(h) Std. \(m) Min."
        }
        return "\(m) Min."
    }

    static func shortDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
