import SwiftUI

@main
struct MotoTourApp: App {
    @State private var settings = AppSettings()
    @State private var locationService = LocationService()
    @State private var routingService = RoutingService()
    @State private var newsService = TrafficNewsService()
    @State private var navigationEngine = NavigationEngine()
    @State private var tourStore = TourStore()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(settings)
                .environment(locationService)
                .environment(routingService)
                .environment(newsService)
                .environment(navigationEngine)
                .environment(tourStore)
                .task {
                    locationService.requestPermission()
                    await newsService.refresh()
                }
        }
    }
}
