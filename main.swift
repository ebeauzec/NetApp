import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let windowRect = NSRect(x: 0, y: 0, width: 1440, height: 900)
        window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "NetApp Solutions Architect Configurator"
        window.makeKeyAndOrderFront(nil)

        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")

        let contentController = WKUserContentController()
        contentController.add(self, name: "downloadHandler")
        configuration.userContentController = contentController

        webView = WKWebView(frame: window.contentView!.bounds, configuration: configuration)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        window.contentView!.addSubview(webView)

        let resourcesURL = Bundle.main.resourceURL!
        let htmlURL = resourcesURL.appendingPathComponent("index.html")
        webView.loadFileURL(htmlURL, allowingReadAccessTo: resourcesURL)
    }

    // JS Bridge handler for downloads
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "downloadHandler",
              let body = message.body as? [String: Any],
              let base64DataStr = body["data"] as? String,
              let filename = body["filename"] as? String else {
            return
        }
        
        guard let data = Data(base64Encoded: base64DataStr) else { return }
        
        let fileManager = FileManager.default
        let downloadsFolder = fileManager.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let destinationURL = downloadsFolder.appendingPathComponent(filename)
        
        if fileManager.fileExists(atPath: destinationURL.path) {
            try? fileManager.removeItem(at: destinationURL)
        }
        
        do {
            try data.write(to: destinationURL)
            let alert = NSAlert()
            alert.messageText = "Download Complete"
            alert.informativeText = "Successfully saved \(filename) to your Downloads folder."
            alert.alertStyle = .informational
            alert.addButton(withTitle: "OK")
            alert.runModal()
        } catch {
            let alert = NSAlert()
            alert.messageText = "Download Failed"
            alert.informativeText = "Error writing file: \(error.localizedDescription)"
            alert.alertStyle = .critical
            alert.addButton(withTitle: "OK")
            alert.runModal()
        }
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let fileManager = FileManager.default
        let downloadsFolder = fileManager.urls(for: .downloadsDirectory, in: .userDomainMask).first!
        let destinationURL = downloadsFolder.appendingPathComponent(suggestedFilename)
        if fileManager.fileExists(atPath: destinationURL.path) {
            try? fileManager.removeItem(at: destinationURL)
        }
        completionHandler(destinationURL)
    }

    func downloadDidFinish(_ download: WKDownload) {
        let alert = NSAlert()
        alert.messageText = "Download Complete"
        alert.informativeText = "Your file has been saved to your Downloads folder."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let alert = NSAlert()
        alert.messageText = "Download Failed"
        alert.informativeText = "An error occurred: \(error.localizedDescription)"
        alert.alertStyle = .critical
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
