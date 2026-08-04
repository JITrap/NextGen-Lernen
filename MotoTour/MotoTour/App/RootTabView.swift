import SwiftUI

struct RootTabView: View {
    @Environment(NavigationEngine.self) private var navigationEngine

    private var isNavigating: Binding<Bool> {
        Binding(
            get: { navigationEngine.state == .navigating || navigationEngine.state == .arrived },
            set: { showing in
                if !showing { navigationEngine.stop() }
            }
        )
    }

    var body: some View {
        TabView {
            MapScreen()
                .tabItem { Label("Karte", systemImage: "map.fill") }
            NewsScreen()
                .tabItem { Label("News", systemImage: "exclamationmark.triangle.fill") }
            ToursScreen()
                .tabItem { Label("Touren", systemImage: "point.bottomleft.forward.to.point.topright.scurvepath.fill") }
            SettingsScreen()
                .tabItem { Label("Einstellungen", systemImage: "gearshape.fill") }
        }
        .fullScreenCover(isPresented: isNavigating) {
            NavigationScreen()
        }
    }
}
