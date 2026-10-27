// Optional macOS preparation helper. Reads local references; no provider calls.
import Foundation
import Vision
import AppKit

let folder = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "design-references"
let files = try FileManager.default.contentsOfDirectory(atPath: folder).filter { $0.hasSuffix(".png") }.sorted()
var output: [String: Any] = [:]
for file in files {
    let url = URL(fileURLWithPath: folder).appendingPathComponent(file)
    let image = NSImage(contentsOf: url)!
    var rect = CGRect(origin: .zero, size: image.size)
    let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["id-ID", "en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: cg).perform([request])
    let lines: [[String: Any]] = (request.results ?? []).compactMap { item in
        guard let candidate = item.topCandidates(1).first else { return nil }
        let b = item.boundingBox
        return ["text": candidate.string, "confidence": candidate.confidence,
                "x": b.minX * CGFloat(cg.width), "y": (1 - b.maxY) * CGFloat(cg.height),
                "w": b.width * CGFloat(cg.width), "h": b.height * CGFloat(cg.height)]
    }
    output[file] = ["width": cg.width, "height": cg.height, "lines": lines]
}
let data = try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
