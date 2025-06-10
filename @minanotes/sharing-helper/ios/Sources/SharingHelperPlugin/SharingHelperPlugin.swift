import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(SharingHelperPlugin)
public class SharingHelperPlugin: CAPPlugin {
    // App Group ID - must match your Share Extension and main app capabilities
    let appGroupId = "group.io.mina.app" // <<< IMPORTANT: VERIFY THIS IS YOUR APP GROUP ID
    let sharedKey = "sharedItemKey"     // Key used in ShareViewController

    @objc func checkForSharedItem(_ call: CAPPluginCall) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("SharingHelperPlugin: FATAL ERROR - Could not initialize UserDefaults with App Group ID: \(appGroupId)")
            call.reject("Failed to access App Group UserDefaults. Check App Group ID and configuration.")
            return
        }

        // Attempt to retrieve the dictionary
        if let sharedDict = userDefaults.dictionary(forKey: sharedKey) {
            print("SharingHelperPlugin: Found shared item: \(sharedDict)")

            var result = JSObject()
            if let type = sharedDict["type"] as? String {
                result["type"] = type
                
                if type == "image" {
                    if let filePath = sharedDict["value"] as? String {
                        // Instead of just returning the path, read the file and return base64 data
                        let fileURL = URL(fileURLWithPath: filePath)
                        do {
                            let imageData = try Data(contentsOf: fileURL)
                            result["base64Data"] = imageData.base64EncodedString()
                            result["filename"] = fileURL.lastPathComponent
                            // Keep the original path for reference if needed, though not strictly necessary for processing
                            result["originalPath"] = filePath 
                        } catch {
                            print("SharingHelperPlugin: Error reading image file at path \(filePath): \(error)")
                            // Fallback or error indication if file read fails
                            result["errorLoadingImage"] = "Failed to read image data from shared path"
                            // Still return the path for potential debugging on JS side
                            result["value"] = filePath 
                        }
                    } else {
                        result["errorLoadingImage"] = "Image path not found in shared data"
                    }
                } else if let value = sharedDict["value"] as? String {
                    // For non-image types (e.g., URL), just pass the value
                    result["value"] = value
                }
            }
            
            if let text = sharedDict["text"] as? String {
                result["text"] = text
            }
            
            // Crucially, remove the item after retrieving to prevent reprocessing
            userDefaults.removeObject(forKey: sharedKey)
            userDefaults.synchronize() // Ensure removal is saved

            call.resolve(result)
        } else {
            // No item found, resolve with nil or an empty object to indicate nothing was shared
            print("SharingHelperPlugin: No shared item found in UserDefaults for key '\(sharedKey)'.")
            call.resolve([:]) // Resolve with an empty object, JS can check if type/value exist
        }
    }
}
