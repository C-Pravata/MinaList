//
//  ShareViewController.swift
//  MinaShare
//
//  Created by Chris Pravata on 5/28/25.
//

import UIKit
import Social
import MobileCoreServices // Important for UTType constants
import UniformTypeIdentifiers // For newer iOS versions

class ShareViewController: SLComposeServiceViewController {

    // Replace with your actual App Group ID if different
    let appGroupId = "group.io.mina.app" // <<< ENSURE THIS EXACTLY MATCHES YOUR APP GROUP ID
    let sharedKey = "sharedItemKey"

    override func viewDidLoad() {
        super.viewDidLoad()
        self.placeholder = "Add to PurpleNote..." // Optional: Placeholder text for the share sheet
        // You can customize the navigation bar further if needed:
        // self.title = "Add to Note"
        // let postButton = UIBarButtonItem(title: "Post", style: .done, target: self, action: #selector(didSelectPost))
        // self.navigationItem.rightBarButtonItem = postButton
        // To change "Cancel" button text or add other items, you might need more customization.
    }

    override func isContentValid() -> Bool {
        // Basic validation:
        // Allow posting if there's an attachment.
        // If you use `contentText`, you might validate its length.
        if let item = extensionContext?.inputItems.first as? NSExtensionItem,
           let _ = item.attachments?.first {
            return true
        }
        return false
    }

    override func didSelectPost() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            print("Share Extension: No item or attachment found.")
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        let sharedUserDefaults = UserDefaults(suiteName: appGroupId)
        if sharedUserDefaults == nil {
            print("Share Extension: FATAL ERROR - Could not initialize UserDefaults with App Group ID: \(appGroupId). Check App Group configuration.")
            self.extensionContext?.cancelRequest(withError: NSError(domain: "com.mina.app.MinaShare.ErrorDomain", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Failed to access App Group."]))
            return
        }

        // Handle URL
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                guard let self = self else { return }
                defer {
                    // Always complete the request, regardless of success or failure in processing
                    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                }
                if let nsError = error as NSError? {
                     print("Share Extension: Error loading URL item: \(nsError.localizedDescription)")
                     return
                }
                
                if let url = item as? URL {
                    print("Share Extension: Received URL - \(url.absoluteString)")
                    sharedUserDefaults?.set(["type": "url", "value": url.absoluteString, "text": self.contentText ?? ""], forKey: self.sharedKey)
                    // synchronize() is not strictly necessary on modern iOS but doesn't hurt for extensions.
                    sharedUserDefaults?.synchronize()
                } else {
                    print("Share Extension: Could not cast item to URL.")
                }
            }
        }
        // Handle Image
        else if itemProvider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] (item, error) in
                guard let self = self else { return }
                defer {
                    self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                }
                if let nsError = error as NSError? {
                     print("Share Extension: Error loading Image item: \(nsError.localizedDescription)")
                     return
                }

                var sharedImageData: Data? = nil
                var imageFileExtension: String = "png" // Default to PNG

                if let url = item as? URL {
                    print("Share Extension: Received Image via URL - \(url)")
                    let pathExtension = url.pathExtension.lowercased()
                    if ["jpg", "jpeg"].contains(pathExtension) {
                        imageFileExtension = "jpg"
                    }
                    if let data = try? Data(contentsOf: url) {
                        sharedImageData = data
                    } else {
                         print("Share Extension: Could not load image data from URL: \(url)")
                    }
                } else if let image = item as? UIImage {
                    print("Share Extension: Received UIImage directly.")
                    if let pngData = image.pngData() {
                        sharedImageData = pngData
                        imageFileExtension = "png"
                    } else if let jpegData = image.jpegData(compressionQuality: 0.8) {
                        sharedImageData = jpegData
                        imageFileExtension = "jpg"
                    } else {
                        print("Share Extension: Could not convert UIImage to PNG or JPEG data.")
                    }
                } else if let imageData = item as? Data {
                    print("Share Extension: Received image as Data directly.")
                    sharedImageData = imageData
                    // Basic check for JPEG or PNG from data magic bytes (very rudimentary)
                    if imageData.count > 4 {
                        if imageData[0] == 0xFF && imageData[1] == 0xD8 && imageData[2] == 0xFF { // JPEG
                            imageFileExtension = "jpg"
                        } else if imageData[0] == 0x89 && imageData[1] == 0x50 && imageData[2] == 0x4E && imageData[3] == 0x47 { // PNG
                            imageFileExtension = "png"
                        }
                    }
                }

                if let dataToSave = sharedImageData {
                    let imageIdentifier = UUID().uuidString + "." + imageFileExtension
                    if let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: self.appGroupId) {
                        let fileURL = directory.appendingPathComponent(imageIdentifier)
                        do {
                            try dataToSave.write(to: fileURL)
                            print("Share Extension: Image saved to App Group at \(fileURL.path)")
                            sharedUserDefaults?.set(["type": "image", "value": fileURL.path, "text": self.contentText ?? ""], forKey: self.sharedKey)
                            sharedUserDefaults?.synchronize()
                        } catch let writeError {
                            print("Share Extension: Error saving image to App Group: \(writeError.localizedDescription)")
                        }
                    } else {
                        print("Share Extension: Could not get App Group directory.")
                    }
                } else {
                     print("Share Extension: No image data could be processed or was suitable for saving.")
                }
            }
        }
        // Handle other types or default case
        else {
            itemProvider.loadPreviewImage(options: nil) { [weak self] (item, error) in
                 guard let self = self else { return }
                 if let item = item {
                    print("Share Extension: Received an item of an unsupported type. Previewable item: \(item)")
                 } else {
                    print("Share Extension: Received an item of an unsupported type. No preview available.")
                 }
                 self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            }
        }
    }

    override func configurationItems() -> [Any]! {
        // To add configuration options to the sheet.
        // Return an array of SLComposeSheetConfigurationItem here.
        // For now, we'll return an empty array for no configuration items.
        return []
    }
}
