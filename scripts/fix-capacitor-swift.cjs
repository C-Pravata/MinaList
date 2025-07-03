const fs = require('fs');
const path = require('path');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const filesToFix = [
  {
    filePath: 'node_modules/@capacitor/filesystem/ios/Sources/FilesystemPlugin/FilesystemError.swift',
    replacements: [
      {
        find: `        case .bridgeNotInitialised: "Capacitor bridge isn't initialized."`,
        replace: `        case .bridgeNotInitialised: return "Capacitor bridge isn't initialized."`
      },
      {
        find: `        case .invalidInput(let method): "The '\(method.rawValue)' input parameters aren't valid."`,
        replace: `        case .invalidInput(let method): return "The '\(method.rawValue)' input parameters aren't valid."`
      },
      {
        find: `        case .invalidPath(_ path: String): "Invalid \(!path.isEmpty ? "'" + path + "' " : "")path."`,
        replace: `        case .invalidPath(let path): return "Invalid \(!path.isEmpty ? "'" + path + "' " : "")path."`
      },
      {
        find: `        case .fileNotFound(method: IONFileMethod, _ path: String): "'\(method.rawValue)' failed because file\(!path.isEmpty ? " at '" + path + "' " : "") does not exist."`,
        replace: `        case .fileNotFound(let method, let path): return "'\(method.rawValue)' failed because file\(!path.isEmpty ? " at '" + path + "' " : "") does not exist."`
      },
      {
        find: `        case .directoryAlreadyExists(_ path: String): "Directory\(!path.isEmpty ? " at '" + path + "' " : "") already exists, cannot be overwritten."`,
        replace: `        case .directoryAlreadyExists(let path): return "Directory\(!path.isEmpty ? " at '" + path + "' " : "") already exists, cannot be overwritten."`
      },
      {
        find: `        case .parentDirectoryMissing: "Missing parent directory - possibly recursive=false was passed or parent directory creation failed."`,
        replace: `        case .parentDirectoryMissing: return "Missing parent directory - possibly recursive=false was passed or parent directory creation failed."`
      },
      {
        find: `        case .cannotDeleteChildren: "Cannot delete directory with children; received recursive=false but directory has contents."`,
        replace: `        case .cannotDeleteChildren: return "Cannot delete directory with children; received recursive=false but directory has contents."`
      },
      {
        find: `        case .operationFailed(method: IONFileMethod, _ error: Error): "'\(method.rawValue)' failed with: \(error.localizedDescription)"`,
        replace: `        case .operationFailed(let method, let error): return "'\(method.rawValue)' failed with: \(error.localizedDescription)"`
      },
      // Also fix the 'code' getter, as it's likely to be overwritten too
      {
        find: `        case .bridgeNotInitialised: 4`,
        replace: `        case .bridgeNotInitialised: return 4`
      },
      {
        find: `        case .invalidInput: 5`,
        replace: `        case .invalidInput: return 5`
      },
      {
        find: `        case .invalidPath: 6`,
        replace: `        case .invalidPath: return 6`
      },
      {
        find: `        case .fileNotFound: 8`,
        replace: `        case .fileNotFound: return 8`
      },
      {
        find: `        case .directoryAlreadyExists: 10`,
        replace: `        case .directoryAlreadyExists: return 10`
      },
      {
        find: `        case .parentDirectoryMissing: 11`,
        replace: `        case .parentDirectoryMissing: return 11`
      },
      {
        find: `        case .cannotDeleteChildren: 12`,
        replace: `        case .cannotDeleteChildren: return 12`
      },
      {
        find: `        case .operationFailed: 13`,
        replace: `        case .operationFailed: return 13`
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/ios/Capacitor/Capacitor/Codable/JSValueEncoder.swift',
    replacements: [
      {
        find: `            "SingleValueContainer"`,
        replace: `            return "SingleValueContainer"`
      },
      {
        find: `            "UnkeyedContainer"`,
        replace: `            return "UnkeyedContainer"`
      },
      {
        find: `            "KeyedContainer"`,
        replace: `            return "KeyedContainer"`
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/ios/Capacitor/Capacitor/Codable/JSValueDecoder.swift',
    replacements: [
      {
        find: `            return Date(timeIntervalSince1970: value.doubleValue / Double(MSEC_PER_SEC))`,
        replace: `            return Date(timeIntervalSince1970: value.doubleValue / 1000.0)`
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/ios/Capacitor/Capacitor/Codable/JSValueEncoder.swift',
    replacements: [
      {
        find: `            try (value.timeIntervalSince1970 * Double(MSEC_PER_SEC)).encode(to: self)`,
        replace: `            try (value.timeIntervalSince1970 * 1000.0).encode(to: self)`
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/ios/Capacitor/Capacitor/CAPApplicationDelegateProxy.swift',
    replacements: [
      {
        find: 'CAPPlugin.pluginMethodHandlers',
        replace: 'CAPPlugin.pluginMethodHandlers as [String : Any]'
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift',
    replacements: [
      {
        find: 'return [:]',
        replace: 'return [:] as [String: Any]'
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/filesystem/ios/Sources/FilesystemPlugin/FilesystemOperationExecutor.swift',
    replacements: [
      {
        find: `        switch error {\n        case IONFILEDirectoryManagerError.notEmpty: return .cannotDeleteChildren\n        case IONFILEDirectoryManagerError.alreadyExists: return .directoryAlreadyExists(path)\n        case IONFILEFileManagerError.missingParentFolder: return .parentDirectoryMissing\n        case IONFILEFileManagerError.fileNotFound: return .fileNotFound(method: method, path)\n        default: return .operationFailed(method: method, error)\n        }\n        case IONFILEDirectoryManagerError.notEmpty: .cannotDeleteChildren\n        case IONFILEDirectoryManagerError.alreadyExists: .directoryAlreadyExists(path)\n        case IONFILEFileManagerError.missingParentFolder: .parentDirectoryMissing\n        case IONFILEFileManagerError.fileNotFound: .fileNotFound(method: method, path)\n        default: .operationFailed(method: method, error)\n        }`,
        replace: `        switch error {\n        case IONFILEDirectoryManagerError.notEmpty: return .cannotDeleteChildren\n        case IONFILEDirectoryManagerError.alreadyExists: return .directoryAlreadyExists(path)\n        case IONFILEFileManagerError.missingParentFolder: return .parentDirectoryMissing\n        case IONFILEFileManagerError.fileNotFound: return .fileNotFound(method: method, path)\n        default: return .operationFailed(method: method, error)\n        }`
      }
    ]
  },
  {
    filePath: 'node_modules/@capacitor/filesystem/ios/Sources/FilesystemPlugin/IONFileStructures+Converters.swift',
    replacements: [
      {
        find: `        case Constants.StringEncodingValue.ascii: .ascii`,
        replace: `        case Constants.StringEncodingValue.ascii: return .ascii`
      },
      {
        find: `        case Constants.StringEncodingValue.utf16: .utf16`,
        replace: `        case Constants.StringEncodingValue.utf16: return .utf16`
      },
      {
        find: `        case Constants.StringEncodingValue.utf8: .utf8`,
        replace: `        case Constants.StringEncodingValue.utf8: return .utf8`
      },
      {
        find: `        default: .utf8`,
        replace: `        default: return .utf8`
      },
      {
        find: `        case Constants.DirectoryTypeValue.cache: .cache`,
        replace: `        case Constants.DirectoryTypeValue.cache: return .cache`
      },
      {
        find: `        case Constants.DirectoryTypeValue.data, Constants.DirectoryTypeValue.documents, Constants.DirectoryTypeValue.external, Constants.DirectoryTypeValue.externalCache, Constants.DirectoryTypeValue.externalStorage: .document`,
        replace: `        case Constants.DirectoryTypeValue.data, Constants.DirectoryTypeValue.documents, Constants.DirectoryTypeValue.external, Constants.DirectoryTypeValue.externalCache, Constants.DirectoryTypeValue.externalStorage: return .document`
      },
      {
        find: `        case Constants.DirectoryTypeValue.library: .library`,
        replace: `        case Constants.DirectoryTypeValue.library: return .library`
      },
      {
        find: `        case Constants.DirectoryTypeValue.libraryNoCloud: .notSyncedLibrary`,
        replace: `        case Constants.DirectoryTypeValue.libraryNoCloud: return .notSyncedLibrary`
      },
      {
        find: `        case Constants.DirectoryTypeValue.temporary: .temporary`,
        replace: `        case Constants.DirectoryTypeValue.temporary: return .temporary`
      },
      {
        find: `        default: nil`,
        replace: `        default: return nil`
      },
      {
        find: `        case .byteBuffer(let data): data.base64EncodedString()`,
        replace: `        case .byteBuffer(let data): return data.base64EncodedString()`
      },
      {
        find: `        case .string(_, let text): text`,
        replace: `        case .string(_, let text): return text`
      },
      {
        find: `        @unknown default: ""`,
        replace: `        @unknown default: return ""`
      },
      {
        find: `        case .directory: Constants.FileItemTypeValue.directory`,
        replace: `        case .directory: return Constants.FileItemTypeValue.directory`
      },
      {
        find: `        case .file: Constants.FileItemTypeValue.file`,
        replace: `        case .file: return Constants.FileItemTypeValue.file`
      },
      {
        find: `        @unknown default: Constants.FileItemTypeValue.fallback`,
        replace: `        @unknown default: return Constants.FileItemTypeValue.fallback`
      }
    ]
  }
];

filesToFix.forEach(({ filePath, replacements }) => {
  const fullPath = path.join(__dirname, '..', filePath);
  let content = fs.readFileSync(fullPath, 'utf8');

  replacements.forEach(({ find, replace }) => {
    const regex = new RegExp(escapeRegExp(find), 'g');
    content = content.replace(regex, replace);
  });

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Fixed: ${filePath}`);
});

console.log('Capacitor Swift files fixed successfully!'); 