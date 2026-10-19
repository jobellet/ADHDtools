use rodio::source::Source;
use rodio::{OutputStream, Sink};
use std::thread;
use std::time::Duration;

#[tauri::command]
pub fn native_play_sound(sound: String) -> Result<(), String> {
    thread::spawn(move || {
        let (_stream, stream_handle) = OutputStream::try_default().unwrap();
        let sink = Sink::try_new(&stream_handle).unwrap();

        // Implement a very basic sine wave sound based on the requested string
        let frequency = match sound.as_str() {
            "chime" => 660.0,
            "digital" => 880.0,
            _ => 440.0, // default "bell"
        };

        let _source = rodio::source::SineWave::new(frequency)
            .take_duration(Duration::from_secs_f32(1.5))
            .fade_in(Duration::from_millis(50))
            .amplify(0.2); // Just to not blast ears initially

        // We simulate exponential decay by applying a simple fade_out instead.
        // `rodio` lacks a built-in exponential decay filter without manually implementing `Source`.
        // However, a fade_out effectively acts as an envelope for the tone.
        // Actually, since there's no built-in exponential decay out-of-the-box in `rodio` standard,
        // we'll implement a custom envelope.

        // As a simpler workaround that achieves "exponential decay" effect,
        // we can use a custom source wrapper or use `.amplify()` changes over time,
        // but `Source::amplify` takes a constant f32.
        // Let's implement a quick custom source for exponential decay:

        struct DecaySource<S> {
            inner: S,
            decay_rate: f32,
            current_volume: f32,
            _sample_rate: u32,
        }

        impl<S> Iterator for DecaySource<S>
        where
            S: Source<Item = f32>,
        {
            type Item = f32;

            #[inline]
            fn next(&mut self) -> Option<f32> {
                self.inner.next().map(|sample| {
                    let out = sample * self.current_volume;
                    self.current_volume *= self.decay_rate;
                    out
                })
            }
        }

        impl<S> Source for DecaySource<S>
        where
            S: Source<Item = f32>,
        {
            fn current_frame_len(&self) -> Option<usize> {
                self.inner.current_frame_len()
            }

            fn channels(&self) -> u16 {
                self.inner.channels()
            }

            fn sample_rate(&self) -> u32 {
                self.inner.sample_rate()
            }

            fn total_duration(&self) -> Option<Duration> {
                self.inner.total_duration()
            }
        }

        let sample_rate = 48000;
        let base_source = rodio::source::SineWave::new(frequency)
            .take_duration(Duration::from_secs_f32(2.0));

        // For a 2 second decay, we want volume to approach 0.
        // We apply exponential decay where each sample reduces the volume.
        // Formula: v_new = v_old * decay_rate
        let decay_rate = 0.9999;

        let dec_source = DecaySource {
            inner: base_source,
            decay_rate: decay_rate,
            current_volume: 0.2, // Initial amplification
            _sample_rate: sample_rate as u32,
        };

        sink.append(dec_source);
        sink.sleep_until_end();
    });

    Ok(())
}

pub fn play_sound(sound: &str) {
    let _ = native_play_sound(sound.to_string());
}
