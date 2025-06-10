// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MinanotesSharingHelper",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "MinanotesSharingHelper",
            targets: ["SharingHelperPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "SharingHelperPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/SharingHelperPlugin"),
        .testTarget(
            name: "SharingHelperPluginTests",
            dependencies: ["SharingHelperPlugin"],
            path: "ios/Tests/SharingHelperPluginTests")
    ]
)