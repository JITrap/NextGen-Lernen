import SwiftUI
import MapKit
import CoreLocation
import UIKit

/// Turn-by-Turn-Navigationsbildschirm.
/// Wird als fullScreenCover angezeigt, solange die Navigation läuft oder das Ziel erreicht ist.
struct NavigationScreen: View {
    @Environment(NavigationEngine.self) private var navigationEngine
    @Environment(LocationService.self) private var locationService
    @Environment(AppSettings.self) private var settings

    @State private var camera: MapCameraPosition = .userLocation(followsHeading: true, fallback: .automatic)

    var body: some View {
        ZStack {
            navigationMap

            VStack(spacing: 10) {
                maneuverBanner

                if let hint = navigationEngine.banner {
                    hintCapsule(hint)
                }

                if navigationEngine.isRerouting {
                    reroutingCapsule
                }

                Spacer()

                bottomBar
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 8)

            if navigationEngine.state == .arrived {
                arrivedOverlay
            }
        }
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = settings.keepScreenOn
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    // MARK: - Karte

    private var navigationMap: some View {
        Map(position: $camera) {
            if let route = navigationEngine.route, route.coordinates.count > 1 {
                MapPolyline(coordinates: route.clCoordinates)
                    .stroke(.blue, lineWidth: 6)
            }
            UserAnnotation()
        }
        .mapStyle(settings.mapStyleOption.mapStyle)
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: - Manöver-Banner

    private var maneuverBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(.title)
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text(Format.distance(navigationEngine.distanceToNextManeuver))
                        .font(.title.bold())
                        .foregroundStyle(.white)
                    Text(navigationEngine.currentInstruction)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                }
                Spacer(minLength: 0)
            }

            if let next = navigationEngine.nextInstruction {
                Divider()
                    .overlay(Color.white.opacity(0.3))
                Text("Danach: \(next)")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(radius: 4)
    }

    // MARK: - Hinweise

    private func hintCapsule(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.orange, in: Capsule())
        .shadow(radius: 3)
    }

    private var reroutingCapsule: some View {
        HStack(spacing: 10) {
            ProgressView()
                .tint(.white)
            Text("Route wird neu berechnet …")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.75), in: Capsule())
        .shadow(radius: 3)
    }

    // MARK: - Untere Leiste

    private var bottomBar: some View {
        HStack(spacing: 0) {
            infoColumn(value: Format.distance(navigationEngine.remainingDistance), label: "Distanz")
            infoColumn(value: Format.duration(navigationEngine.remainingTime), label: "Dauer")
            infoColumn(value: arrivalTimeText, label: "Ankunft")
            infoColumn(value: Format.speedKmh(locationService.speed), label: "Tempo")

            Button {
                navigationEngine.stop()
            } label: {
                Text("Beenden")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.red, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(radius: 4)
    }

    private func infoColumn(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity)
    }

    private var arrivalTimeText: String {
        let arrival = Date().addingTimeInterval(navigationEngine.remainingTime)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: arrival)
    }

    // MARK: - Ziel erreicht

    private var arrivedOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 52))
                .foregroundStyle(.white)
            Text("Ziel erreicht")
                .font(.largeTitle.bold())
                .foregroundStyle(.white)
            Button {
                navigationEngine.stop()
            } label: {
                Text("Beenden")
                    .font(.headline)
                    .foregroundStyle(Color.green)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 12)
                    .background(Color.white, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.green.opacity(0.92))
        .ignoresSafeArea()
    }
}

#Preview {
    NavigationScreen()
        .environment(NavigationEngine())
        .environment(LocationService())
        .environment(AppSettings())
}
