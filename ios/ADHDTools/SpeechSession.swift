import AVFoundation
import Speech

/// Voice input with iOS speech recognition (SFSpeechRecognizer). The web app calls
/// native_start_speech { lang }, polls native_poll_speech, and native_stop_speech returns
/// the final snapshot: { status: "listening" | "done" | "error", transcript, error }.
final class SpeechSession {
    static let shared = SpeechSession()

    private let engine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var status = "idle"
    private var transcript = ""
    private var errorMessage = ""

    func start(_ lang: String) {
        stopInternal()
        status = "listening"
        transcript = ""
        errorMessage = ""
        SFSpeechRecognizer.requestAuthorization { authorization in
            guard authorization == .authorized else {
                self.status = "error"
                self.errorMessage = "speech recognition not authorized"
                return
            }
            DispatchQueue.main.async { self.begin(lang: lang) }
        }
    }

    private func begin(lang: String) {
        let locale = Locale(identifier: lang)
        recognizer = SFSpeechRecognizer(locale: locale)
        guard let recognizer, recognizer.isAvailable else {
            status = "error"
            errorMessage = "speech recognizer unavailable for \(lang)"
            return
        }
        request = SFSpeechAudioBufferRecognitionRequest()
        guard let request else { return }
        request.shouldReportPartialResults = true
        if #available(iOS 17, *) {
            AVAudioApplication.shared.requestRecordPermission { granted in
                guard granted else {
                    self.status = "error"
                    self.errorMessage = "microphone not authorized"
                    return
                }
                self.startEngine(recognizer: recognizer, request: request)
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    self.status = "error"
                    self.errorMessage = "microphone not authorized"
                    return
                }
                self.startEngine(recognizer: recognizer, request: request)
            }
        }
    }

    private func startEngine(recognizer: SFSpeechRecognizer, request: SFSpeechAudioBufferRecognitionRequest) {
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.transcript = result.bestTranscription.formattedString
                if result.isFinal { self.status = "done" }
            }
            if let error {
                if self.status == "listening" {
                    self.status = "error"
                    self.errorMessage = error.localizedDescription
                }
            }
        }
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
            self.request?.append(buffer)
        }
        engine.prepare()
        try? engine.start()
    }

    func snapshot() -> [String: Any] {
        ["status": status, "transcript": transcript, "error": errorMessage]
    }

    func stop() -> [String: Any] {
        if status == "listening" { status = "done" }
        stopInternal()
        return snapshot()
    }

    private func stopInternal() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        recognizer = nil
    }
}
