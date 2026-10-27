// Optional local macOS Vision segmentation. No network or provider calls.
import Foundation
import Vision
import AppKit
import CoreImage

struct Job: Decodable { let input: String; let output: String }
let jobs: [Job]
if CommandLine.arguments.count == 2 {
    jobs = try JSONDecoder().decode([Job].self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
} else {
    jobs = [Job(input: CommandLine.arguments[1], output: CommandLine.arguments[2])]
}
let context = CIContext()
do { for job in jobs {
    try autoreleasepool {
        let image = CIImage(contentsOf: URL(fileURLWithPath: job.input))!
        let handler = VNImageRequestHandler(ciImage: image)
        let request = VNGenerateForegroundInstanceMaskRequest()
        try handler.perform([request])
        guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
            throw NSError(domain: "GenieCutouts", code: 1, userInfo: [NSLocalizedDescriptionKey: "No foreground in \(job.input). Supply a reviewed transparent cutout."])
        }
        let mask = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)
        let result = image.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputBackgroundImageKey: CIImage(color: .clear).cropped(to: image.extent),
            kCIInputMaskImageKey: CIImage(cvPixelBuffer: mask)
        ])
        try context.writePNGRepresentation(of: result, to: URL(fileURLWithPath: job.output), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
        print("Separated \(URL(fileURLWithPath: job.output).lastPathComponent)")
        fflush(stdout)
    }
} } catch {
    fputs("Local artwork segmentation failed: \(error)\n", stderr)
    exit(1)
}
