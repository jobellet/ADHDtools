#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>
#import <QuartzCore/QuartzCore.h>
#include <string.h>

void macos_bring_app_to_front(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            [NSApp activateIgnoringOtherApps:YES];
            NSWindow *target = [NSApp mainWindow];
            if (!target) {
                target = [NSApp keyWindow];
            }
            if (!target) {
                for (NSWindow *w in [NSApp windows]) {
                    if ([w canBecomeKeyWindow]) {
                        target = w;
                        break;
                    }
                }
            }
            if (target) {
                if ([target isMiniaturized]) {
                    [target deminiaturize:nil];
                }
                [target makeKeyAndOrderFront:nil];
                [target orderFrontRegardless];
            }
        } @catch (NSException *e) {
            NSLog(@"[ADHDtools] Exception in macos_bring_app_to_front: %@", e);
        }
    });
}

static NSLock *g_lock = nil;
static AVAudioEngine *g_audioEngine = nil;
static SFSpeechAudioBufferRecognitionRequest *g_request = nil;
static SFSpeechRecognitionTask *g_task = nil;
static SFSpeechRecognizer *g_recognizer = nil;

static NSString *g_status = @"idle";       // "idle" | "listening" | "done" | "error"
static NSString *g_transcript = @"";
static NSString *g_error = @"";
static CFTimeInterval g_listenStartTime = 0;
static CFTimeInterval g_lastWordTime = 0;
static uint64_t g_sessionId = 0;

static void ensure_lock(void) {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        g_lock = [[NSLock alloc] init];
    });
}

// Must be called on main queue or with care; cleans up audio engine and speech task.
static void stop_engine_on_main(void) {
    @try {
        if (g_audioEngine) {
            if (g_audioEngine.isRunning) {
                [g_audioEngine stop];
            }
            [g_audioEngine.inputNode removeTapOnBus:0];
        }
    } @catch (NSException *ex) {
        // Ignore if tap was not installed
    }
    @try {
        if (g_request) {
            [g_request endAudio];
        }
        if (g_task) {
            [g_task finish];
        }
    } @catch (NSException *ex) {
    }
    g_audioEngine = nil;
    g_request = nil;
    g_task = nil;
    g_recognizer = nil;
}

static void write_state_json(char *out_buf, size_t out_len) {
    if (!out_buf || out_len == 0) return;
    NSDictionary *dict = @{
        @"status": g_status ?: @"idle",
        @"transcript": g_transcript ?: @"",
        @"error": g_error ?: @""
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:nil];
    if (!data) {
        snprintf(out_buf, out_len, "{\"status\":\"error\",\"transcript\":\"\",\"error\":\"json\"}");
        return;
    }
    NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    const char *utf8 = [json UTF8String];
    if (!utf8) {
        snprintf(out_buf, out_len, "{\"status\":\"error\",\"transcript\":\"\",\"error\":\"utf8\"}");
        return;
    }
    strncpy(out_buf, utf8, out_len - 1);
    out_buf[out_len - 1] = '\0';
}

static void start_engine_for_session(uint64_t session, NSString *langStr) {
    dispatch_async(dispatch_get_main_queue(), ^{
        ensure_lock();
        [g_lock lock];
        if (session != g_sessionId) {
            [g_lock unlock];
            return;
        }
        stop_engine_on_main();

        NSLocale *locale = [[NSLocale alloc] initWithLocaleIdentifier:(langStr.length ? langStr : @"en-US")];
        SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:locale];
        if (!recognizer || !recognizer.isAvailable) {
            recognizer = [[SFSpeechRecognizer alloc] init];
        }
        if (!recognizer || !recognizer.isAvailable) {
            g_status = @"error";
            g_error = @"recognizer-unavailable";
            [g_lock unlock];
            return;
        }

        AVAudioEngine *engine = [[AVAudioEngine alloc] init];
        AVAudioInputNode *inputNode = engine.inputNode;
        if (!inputNode) {
            g_status = @"error";
            g_error = @"no-mic";
            [g_lock unlock];
            return;
        }

        AVAudioFormat *format = [inputNode outputFormatForBus:0];
        if (!format || format.sampleRate == 0 || format.channelCount == 0) {
            g_status = @"error";
            g_error = @"no-mic";
            [g_lock unlock];
            return;
        }

        SFSpeechAudioBufferRecognitionRequest *request = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
        request.shouldReportPartialResults = YES;

        @try {
            [inputNode installTapOnBus:0 bufferSize:1024 format:format block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
                [request appendAudioPCMBuffer:buffer];
            }];
            [engine prepare];
            NSError *engineErr = nil;
            if (![engine startAndReturnError:&engineErr]) {
                [inputNode removeTapOnBus:0];
                g_status = @"error";
                g_error = engineErr.localizedDescription ?: @"audio-engine-failed";
                [g_lock unlock];
                return;
            }
        } @catch (NSException *ex) {
            g_status = @"error";
            g_error = ex.reason ?: @"audio-exception";
            [g_lock unlock];
            return;
        }

        g_recognizer = recognizer;
        g_audioEngine = engine;
        g_request = request;
        g_status = @"listening";
        g_listenStartTime = CACurrentMediaTime();
        g_lastWordTime = 0;

        g_task = [recognizer recognitionTaskWithRequest:request resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {
            ensure_lock();
            [g_lock lock];
            if (session != g_sessionId) {
                [g_lock unlock];
                return;
            }
            if (result) {
                NSString *text = result.bestTranscription.formattedString;
                if (text && text.length > 0) {
                    g_transcript = [text copy];
                    g_lastWordTime = CACurrentMediaTime();
                }
                if (result.isFinal) {
                    g_status = @"done";
                    dispatch_async(dispatch_get_main_queue(), ^{
                        stop_engine_on_main();
                    });
                }
            }
            if (error && ![g_status isEqualToString:@"done"]) {
                if (g_transcript.length > 0) {
                    g_status = @"done";
                } else {
                    g_status = @"error";
                    g_error = error.localizedDescription ?: @"speech-error";
                }
                dispatch_async(dispatch_get_main_queue(), ^{
                    stop_engine_on_main();
                });
            }
            [g_lock unlock];
        }];

        [g_lock unlock];
    });
}

void macos_speech_start(const char *lang_cstr) {
    ensure_lock();
    [g_lock lock];
    g_sessionId++;
    uint64_t session = g_sessionId;
    g_status = @"listening";
    g_transcript = @"";
    g_error = @"";
    g_listenStartTime = CACurrentMediaTime();
    g_lastWordTime = 0;
    NSString *langStr = lang_cstr ? [NSString stringWithUTF8String:lang_cstr] : @"en-US";
    [g_lock unlock];

    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL micGranted) {
        if (!micGranted) {
            ensure_lock();
            [g_lock lock];
            if (session == g_sessionId) {
                g_status = @"error";
                g_error = @"mic-denied";
            }
            [g_lock unlock];
            return;
        }

        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
            if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) {
                ensure_lock();
                [g_lock lock];
                if (session == g_sessionId) {
                    g_status = @"error";
                    g_error = @"speech-denied";
                }
                [g_lock unlock];
                return;
            }
            start_engine_for_session(session, langStr);
        }];
    }];
}

void macos_speech_poll(char *out_buf, size_t out_len) {
    ensure_lock();
    [g_lock lock];
    if ([g_status isEqualToString:@"listening"]) {
        CFTimeInterval now = CACurrentMediaTime();
        if (g_transcript.length > 0 && g_lastWordTime > 0 && (now - g_lastWordTime) >= 2.0) {
            // User spoke and paused for 2.0s -> complete automatically
            g_status = @"done";
            dispatch_async(dispatch_get_main_queue(), ^{
                stop_engine_on_main();
            });
        } else if (g_transcript.length == 0 && g_listenStartTime > 0 && (now - g_listenStartTime) >= 12.0) {
            // 12s with no speech detected
            g_status = @"error";
            g_error = @"no-speech";
            dispatch_async(dispatch_get_main_queue(), ^{
                stop_engine_on_main();
            });
        }
    }
    write_state_json(out_buf, out_len);
    [g_lock unlock];
}

void macos_speech_stop(char *out_buf, size_t out_len) {
    ensure_lock();
    [g_lock lock];
    g_sessionId++;
    if ([g_status isEqualToString:@"listening"]) {
        g_status = @"done";
    }
    write_state_json(out_buf, out_len);
    [g_lock unlock];

    dispatch_async(dispatch_get_main_queue(), ^{
        stop_engine_on_main();
    });
}
