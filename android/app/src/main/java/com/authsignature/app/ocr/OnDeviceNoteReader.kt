package com.authsignature.app.ocr

import android.graphics.BitmapFactory
import android.util.Base64
import com.authsignature.app.data.NoteTableReply
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Reads a delivery note photo on the phone itself with Google's ML Kit text recognizer (the model is part of the app):
 * no AI service, no cost, no network, and the photo never leaves the phone. It finds the words and where they are;
 * [NoteTableParser] turns them into the table.
 */
object OnDeviceNoteReader {
    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    suspend fun read(imageBase64: String): NoteTableReply = withContext(Dispatchers.Default) {
        val bytes = Base64.decode(imageBase64, Base64.NO_WRAP)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw IllegalStateException("no image")
        try {
            val text = suspendCancellableCoroutine { cont ->
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener { cont.resume(it) }
                    .addOnFailureListener { cont.resumeWithException(it) }
            }
            val words = text.textBlocks.flatMap { it.lines }.flatMap { it.elements }.mapNotNull { e ->
                e.boundingBox?.let { OcrWord(e.text, it.left, it.top, it.right, it.bottom) }
            }
            val rows = NoteTableParser.parse(words)
            NoteTableReply(legible = rows.isNotEmpty(), rows = rows, comment = "${words.size} words found")
        } finally {
            bitmap.recycle()
        }
    }
}
