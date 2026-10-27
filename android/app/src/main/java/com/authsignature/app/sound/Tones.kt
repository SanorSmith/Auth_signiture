package com.authsignature.app.sound

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.tanh

enum class Wave { Sine, Triangle, Sawtooth }

private data class Voice(
    val f: Double,
    val at: Float,
    val dur: Float,
    val peak: Float,
    val wave: Wave = Wave.Sine,
    val warm: Boolean = false,
    val bell: Boolean = false,
    val pluck: Boolean = false,
    val rich: Boolean = false,
)

/**
 * Every notification and action has its own melody. Notifications from other people last about a
 * second; the sounds that confirm your own action are short so scanning stays quick.
 */
enum class Tone(val key: String, val label: String, val hint: String, val vibration: LongArray, val notification: Boolean) {
    NewRequest("new_request", "New request", "A client asked for a code", longArrayOf(180, 90, 180), true),
    ResetRequested("reset_requested", "Password reset", "Someone asked for a password reset", longArrayOf(150, 80, 150, 80, 150), true),
    CodeIssued("code_issued", "Code ready", "The admin issued your code", longArrayOf(120, 60, 120, 60, 240), true),
    RequestDenied("request_denied", "Request denied", "The admin denied your request", longArrayOf(400), true),
    RequestRemoved("request_removed", "Request removed", "The admin removed your request", longArrayOf(250, 120, 250), true),
    AccessChanged("access_changed", "Access changed", "An admin changed what you can do", longArrayOf(100, 60, 300), true),
    Sent("sent", "Request sent", "Your scan went through", longArrayOf(40), false),
    Found("found", "Code found", "The monitor found the code", longArrayOf(60), false),
    Missing("missing", "Not found", "No code for that number yet", longArrayOf(120), false),
    Done("done", "Done", "An action went through", longArrayOf(40), false),
    Deleted("deleted", "Denied or removed", "A request or user was denied, removed or deleted", longArrayOf(80), false),
    Error("error", "Error", "Something was not accepted", longArrayOf(200), false),
    Counted("counted", "Package counted", "A package was added to the count", longArrayOf(30), false),
    Duplicate("duplicate", "Package already counted", "The same package was scanned twice", longArrayOf(80, 60, 80), false),
    Mismatch("mismatch", "Wrong shipment", "The package does not belong to this shipment", longArrayOf(300, 120, 300, 120, 300), false),
    Finished("finished", "Count finished", "The shipment count was saved", longArrayOf(100, 60, 200), false);

    companion object {
        fun forKind(kind: String) = entries.firstOrNull { it.key == kind }
    }
}

object Tones {
    private const val RATE = 22050

    // Phone speakers are small, so the tones are about twice as loud as the raw notes in the scores.
    private const val LOUDNESS = 2.2f

    private val scores: Map<Tone, List<Voice>> = mapOf(
        // New request (for the admin): two bright bell notes going up, E5 then B5.
        Tone.NewRequest to listOf(
            Voice(659.25, 0f, 0.6f, 0.24f, bell = true, pluck = true, rich = true),
            Voice(987.77, 0.17f, 0.85f, 0.26f, bell = true, pluck = true, rich = true),
        ),
        // Password reset: three quick taps climbing, G5 B5 D6, like a knock.
        Tone.ResetRequested to listOf(
            Voice(783.99, 0f, 0.3f, 0.22f, pluck = true, rich = true),
            Voice(987.77, 0.1f, 0.3f, 0.22f, pluck = true, rich = true),
            Voice(1174.66, 0.2f, 0.7f, 0.24f, bell = true, pluck = true, rich = true),
        ),
        // Code ready (for the client): a fast happy sparkle, C6 E6 G6.
        Tone.CodeIssued to listOf(
            Voice(1046.5, 0f, 0.4f, 0.2f, bell = true, pluck = true, rich = true),
            Voice(1318.5, 0.09f, 0.4f, 0.2f, bell = true, pluck = true, rich = true),
            Voice(1568.0, 0.18f, 0.85f, 0.22f, bell = true, pluck = true, rich = true),
        ),
        // Denied: two soft notes falling, A4 then E4. Gentle, not alarming.
        Tone.RequestDenied to listOf(
            Voice(440.0, 0f, 0.45f, 0.24f, Wave.Triangle, pluck = true, rich = true),
            Voice(329.63, 0.2f, 0.7f, 0.24f, Wave.Triangle, pluck = true, rich = true),
        ),
        // Removed: three short steps down, G4 D4 A3.
        Tone.RequestRemoved to listOf(
            Voice(392.0, 0f, 0.3f, 0.24f, Wave.Triangle, pluck = true, rich = true),
            Voice(293.66, 0.14f, 0.3f, 0.24f, Wave.Triangle, pluck = true, rich = true),
            Voice(220.0, 0.28f, 0.6f, 0.26f, Wave.Triangle, pluck = true, rich = true),
        ),
        // Access changed: a soft shimmer, E5 G#5 B5 almost together.
        Tone.AccessChanged to listOf(
            Voice(659.25, 0f, 0.8f, 0.16f, bell = true, pluck = true, rich = true),
            Voice(830.61, 0.05f, 0.8f, 0.16f, bell = true, pluck = true, rich = true),
            Voice(987.77, 0.1f, 0.9f, 0.16f, bell = true, pluck = true, rich = true),
        ),
        Tone.Sent to listOf(Voice(783.99, 0f, 0.18f, 0.14f), Voice(1046.5, 0.12f, 0.3f, 0.14f)),
        Tone.Found to listOf(Voice(1318.5, 0f, 0.8f, 0.13f, warm = true)),
        Tone.Missing to listOf(Voice(220.0, 0f, 0.25f, 0.16f, Wave.Triangle), Voice(196.0, 0.2f, 0.4f, 0.16f, Wave.Triangle)),
        Tone.Done to listOf(Voice(880.0, 0f, 0.16f, 0.16f), Voice(1318.5, 0.1f, 0.35f, 0.16f)),
        Tone.Deleted to listOf(Voice(392.0, 0f, 0.18f, 0.18f, Wave.Triangle), Voice(261.63, 0.12f, 0.4f, 0.18f, Wave.Triangle)),
        Tone.Error to listOf(Voice(174.61, 0f, 0.45f, 0.07f, Wave.Sawtooth)),
        // Colli counter: a quick tick, two low beeps, a siren-like alert, a completion chime.
        Tone.Counted to listOf(Voice(1568.0, 0f, 0.09f, 0.16f)),
        Tone.Duplicate to listOf(Voice(330.0, 0f, 0.14f, 0.2f, Wave.Triangle), Voice(330.0, 0.22f, 0.14f, 0.2f, Wave.Triangle)),
        Tone.Mismatch to listOf(
            Voice(880.0, 0f, 0.4f, 0.1f, Wave.Sawtooth),
            Voice(622.25, 0.45f, 0.4f, 0.1f, Wave.Sawtooth),
            Voice(880.0, 0.9f, 0.4f, 0.1f, Wave.Sawtooth),
            Voice(622.25, 1.35f, 0.55f, 0.1f, Wave.Sawtooth),
        ),
        Tone.Finished to listOf(
            Voice(523.25, 0f, 0.5f, 0.18f, bell = true),
            Voice(659.25, 0.14f, 0.5f, 0.18f, bell = true),
            Voice(783.99, 0.28f, 0.9f, 0.18f, bell = true),
        ),
    )

    private val cache = HashMap<Tone, ShortArray>()

    /** Length of a tone in seconds (when its last note has faded out). */
    fun seconds(tone: Tone) = (scores.getValue(tone).maxOf { it.at + it.dur })

    private fun wave(kind: Wave, phase: Double): Double = when (kind) {
        Wave.Sine -> sin(2 * PI * phase)
        Wave.Triangle -> 2 / PI * asin(sin(2 * PI * phase))
        Wave.Sawtooth -> 2 * (phase - floor(phase + 0.5))
    }

    /**
     * Envelope: rises in 20 ms, settles, then fades over most of the note's length, so a 2.5 second
     * tone is audible for about 2.5 seconds (a plain exponential fade is inaudible after the first moments).
     */
    private fun envelope(t: Float, dur: Float, top: Float, pluck: Boolean = false): Float {
        if (t < 0f || t > dur) return 0f
        if (pluck) {
            if (t < 0.005f) return top * (t / 0.005f)
            return top * (0.0001f / top).pow((t - 0.005f) / (dur - 0.005f))
        }
        if (t < 0.02f) return top * (t / 0.02f)
        fun exp(a: Float, b: Float, from: Float, to: Float): Float = a * (b / a).pow((t - from) / (to - from))
        return if (dur > 0.3f) {
            when {
                t < dur * 0.45f -> exp(top, top * 0.4f, 0.02f, dur * 0.45f)
                t < dur - 0.12f -> exp(top * 0.4f, top * 0.06f, dur * 0.45f, dur - 0.12f)
                else -> top * 0.06f * (1f - (t - (dur - 0.12f)) / 0.12f)
            }
        } else {
            exp(top, 0.0001f, 0.02f, dur).coerceAtLeast(0f)
        }
    }

    private fun addNote(mix: FloatArray, freq: Double, at: Float, dur: Float, peak: Float, kind: Wave, pluck: Boolean = false, cents: Double = 0.0) {
        val top = peak * LOUDNESS
        val first = (at * RATE).toInt()
        val count = (dur * RATE).toInt()
        for (i in 0 until count) {
            val index = first + i
            if (index >= mix.size) break
            val t = i / RATE.toFloat()
            mix[index] += (envelope(t, dur, top, pluck) * wave(kind, freq * (if (cents != 0.0) 2.0.pow(cents / 1200.0) else 1.0) * t)).toFloat()
        }
    }

    /** The tone as 16-bit mono samples. Everything passes a soft limiter so the louder sound never distorts. */
    fun render(tone: Tone): ShortArray = cache.getOrPut(tone) {
        val voices = scores.getValue(tone)
        // A little room at the end for the echo to die away.
        val mix = FloatArray(((seconds(tone) + 0.1f + 0.45f) * RATE).toInt())
        for (v in voices) {
            addNote(mix, v.f, v.at, v.dur, v.peak, v.wave, v.pluck)
            // A second voice a few cents sharp makes the note fuller, less like a plain test tone.
            if (v.rich) addNote(mix, v.f, v.at, v.dur, v.peak * 0.6f, v.wave, v.pluck, 5.0)
            if (v.warm) addNote(mix, v.f * 2, v.at, v.dur * 0.6f, v.peak * 0.2f, Wave.Sine, v.pluck)
            if (v.bell) {
                addNote(mix, v.f * 2.76, v.at, v.dur * 0.55f, v.peak * 0.3f, Wave.Sine, v.pluck)
                addNote(mix, v.f * 5.4, v.at, v.dur * 0.3f, v.peak * 0.12f, Wave.Sine, v.pluck)
            }
        }
        // A short soft echo (about a tenth of a second, fading) so the notes ring instead of stopping dead.
        if (tone.notification) {
            val d1 = (0.11f * RATE).toInt()
            val d2 = (0.22f * RATE).toInt()
            val dry = mix.copyOf()
            for (i in mix.indices) {
                if (i >= d1) mix[i] += dry[i - d1] * 0.22f
                if (i >= d2) mix[i] += dry[i - d2] * 0.1f
            }
        }
        ShortArray(mix.size) { (tanh(mix[it].toDouble()) * 0.95 * Short.MAX_VALUE).toInt().toShort() }
    }

    /** Peak level (0 to 1) and how many seconds the tone stays above a phone-speaker threshold. Used by tests. */
    fun measure(tone: Tone): Pair<Float, Float> {
        val pcm = render(tone)
        val peak = pcm.maxOf { kotlin.math.abs(it.toInt()) } / Short.MAX_VALUE.toFloat()
        val window = RATE / 20
        var loud = 0
        var i = 0
        while (i + window < pcm.size) {
            var sum = 0.0
            for (j in 0 until window) {
                val x = pcm[i + j] / Short.MAX_VALUE.toDouble()
                sum += x * x
            }
            if (kotlin.math.sqrt(sum / window) > 0.05) loud++
            i += window
        }
        return peak to loud * 0.05f
    }

    /**
     * Plays the tone on the notification volume (the one people keep up so they hear their phone ring),
     * not the media volume, which is usually turned all the way down. Streams from its own thread.
     */
    fun play(tone: Tone) {
        val pcm = render(tone)
        Thread {
            var track: AudioTrack? = null
            try {
                val format = AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
                val minimum = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
                track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build(),
                    )
                    .setAudioFormat(format)
                    .setBufferSizeInBytes(maxOf(minimum, 16384))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                track.setVolume(1f)
                track.play()
                var offset = 0
                while (offset < pcm.size) {
                    val written = track.write(pcm, offset, minOf(4096, pcm.size - offset))
                    if (written <= 0) break
                    offset += written
                }
                // Let the last samples play out before the track is released.
                Thread.sleep(250)
            } catch (_: Exception) {
            } finally {
                runCatching { track?.stop() }
                runCatching { track?.release() }
            }
        }.start()
    }

    /** Why a tone may be silent right now, or null when the phone should be able to play it. */
    fun silenceReason(context: Context): String? {
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as? android.media.AudioManager ?: return null
        return when {
            audio.ringerMode != android.media.AudioManager.RINGER_MODE_NORMAL -> "The phone is on silent or vibrate. Switch it to sound to hear tones."
            audio.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION) == 0 -> "The notification volume is at zero. Raise it in the phone's sound settings."
            else -> null
        }
    }

    fun vibrate(context: Context, tone: Tone) {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (vibrator?.hasVibrator() != true) return
        // Android's pattern starts with a pause, then alternates vibrate and pause.
        vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0) + tone.vibration, -1))
    }
}
