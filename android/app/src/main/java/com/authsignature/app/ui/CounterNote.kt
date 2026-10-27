package com.authsignature.app.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.NoteComparison
import com.authsignature.app.data.NoteReading
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

private enum class Stage { Idle, Reading, Review, Comparing, Result }

/** Reads the photo, turns it upright, shrinks it to 2400 pixels and returns it as base64 text. */
private fun shrinkPhoto(file: File): String {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 2400) sample *= 2
    val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
        ?: throw IllegalStateException("no image")
    val rotation = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
    }
    val scale = minOf(1f, 2400f / maxOf(decoded.width, decoded.height))
    val matrix = Matrix().apply {
        postRotate(rotation)
        postScale(scale, scale)
    }
    val bitmap = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
}

/**
 * Compare the scanned packages with the IDs printed on the delivery note: photograph the note, check
 * what the AI read, compare. The photo is deleted from the phone as soon as it has been sent, and the
 * list of IDs lives only on this screen: it is gone when the dialog closes or the count ends.
 */
@Composable
fun NoteCompareSection(enabled: Boolean) {
    val context = LocalContext.current
    val container = context.container
    val scope = rememberCoroutineScope()

    var stage by remember { mutableStateOf(Stage.Idle) }
    var reading by remember { mutableStateOf<NoteReading?>(null) }
    var text by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<NoteComparison?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var pages by remember { mutableStateOf(0) }
    var added by remember { mutableStateOf<Int?>(null) }
    var addingNext by remember { mutableStateOf(false) }

    val photoFile = remember { File(context.cacheDir, "delivery-note.jpg") }
    val photoUri: Uri = remember { FileProvider.getUriForFile(context, "${context.packageName}.files", photoFile) }

    fun close() {
        stage = Stage.Idle
        reading = null
        text = ""
        result = null
        error = null
        pages = 0
        added = null
    }

    // Leaving the screen removes everything that was read, and any photo still in the cache.
    DisposableEffect(Unit) {
        onDispose {
            reading = null
            text = ""
            result = null
            runCatching { photoFile.delete() }
        }
    }

    fun send() {
        // A page added to what was already read keeps the list; a first photo starts a new one.
        val more = addingNext
        addingNext = false
        val back = if (more) Stage.Review else Stage.Idle
        stage = Stage.Reading
        error = null
        scope.launch {
            try {
                val image = withContext(Dispatchers.Default) { shrinkPhoto(photoFile) }
                runCatching { photoFile.delete() }
                val read = container.api.counterNoteRead(image)
                if (!read.legible || read.ids.isEmpty()) {
                    error = "No package IDs could be read from this photo. Take a clearer, straight-on photo of the note." + (read.comment?.let { "\n" + it } ?: "")
                    stage = back
                    container.signal(Tone.Error)
                } else if (more) {
                    val have = text.split(Regex("[\\s,;]+")).filter { it.isNotBlank() }
                    val known = have.map { it.uppercase().filter(Char::isLetterOrDigit) }.toSet()
                    val fresh = read.ids.filter { it.uppercase().filter(Char::isLetterOrDigit) !in known }
                    text = (have + fresh).joinToString("\n")
                    pages += 1
                    added = fresh.size
                    // Totals on separate pages are often subtotals, so the note's total is not used for several pages.
                    reading = (reading ?: read).copy(total = null)
                    stage = Stage.Review
                } else {
                    reading = read
                    text = read.ids.joinToString("\n")
                    pages = 1
                    added = null
                    stage = Stage.Review
                }
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else error = e.message
                stage = back
                container.signal(Tone.Error)
            } catch (e: Exception) {
                error = "Could not read the delivery note. Try again."
                stage = back
            } finally {
                runCatching { photoFile.delete() }
            }
        }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        if (taken) send() else runCatching { photoFile.delete() }
    }

    fun compare() {
        stage = Stage.Comparing
        error = null
        scope.launch {
            try {
                val ids = text.split(Regex("[\\s,;]+")).filter { it.isNotBlank() }
                val cmp = container.api.counterNoteCompare(ids)
                result = cmp
                stage = Stage.Result
                val clean = cmp.missing.isEmpty() && cmp.extra.isEmpty() && cmp.possible.isEmpty()
                container.signal(if (clean) Tone.Finished else Tone.Mismatch)
            } catch (e: ApiException) {
                if (e.unauthorized) container.signOut() else error = e.message
                stage = Stage.Review
                container.signal(Tone.Error)
            }
        }
    }

    if (stage == Stage.Idle || stage == Stage.Reading || stage == Stage.Comparing) {
        AppCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        runCatching { photoFile.delete() }
                        camera.launch(photoUri)
                    },
                    enabled = enabled && stage == Stage.Idle,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text(if (stage == Stage.Reading) "Reading the delivery note…" else if (stage == Stage.Comparing) "Comparing…" else "Compare with delivery note") }
                error?.let { ErrorNote(it) }
            }
        }
    }

    if (stage == Stage.Review) {
        val read = reading
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Package IDs read from the note") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Check the numbers against the paper and fix any mistake. One ID per line.", style = MaterialTheme.typography.bodyMedium)
                    read?.total?.let { Text("The note says $it colli.", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium) }
                    if (pages > 1 && added != null) Text("$pages pages read. $added new IDs from the last page.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it.uppercase() },
                        textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 15.sp),
                        modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp, max = 320.dp),
                    )
                    error?.let { ErrorNote(it) }
                    OutlinedButton(
                        onClick = {
                            addingNext = true
                            runCatching { photoFile.delete() }
                            camera.launch(photoUri)
                        },
                        enabled = pages < 10,
                        shape = RoundedCornerShape(10.dp),
                    ) { Text("Add another page") }
                }
            },
            confirmButton = { Button(onClick = { compare() }) { Text("Compare") } },
            dismissButton = { OutlinedButton(onClick = { close() }) { Text("Cancel") } },
        )
    }

    if (stage == Stage.Result) {
        result?.let { cmp ->
            val clean = cmp.missing.isEmpty() && cmp.extra.isEmpty() && cmp.possible.isEmpty()
            val noteTotal = reading?.total
            AlertDialog(
                onDismissRequest = {},
                title = {
                    Text(
                        if (clean) "Everything on the note was scanned" else "The scan and the note do not match",
                        color = if (clean) status.success else MaterialTheme.colorScheme.error,
                    )
                },
                text = {
                    Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("${cmp.matched.size} of ${cmp.noteCount} on the note were scanned.", style = MaterialTheme.typography.bodyMedium)
                        if (noteTotal != null && noteTotal != cmp.scannedCount) ErrorNote("The note says $noteTotal colli, you counted ${cmp.scannedCount}.")
                        IdList("Missing: on the note, not scanned", cmp.missing, MaterialTheme.colorScheme.error)
                        IdList("Extra: scanned, not on the note", cmp.extra, status.warn)
                        if (cmp.possible.isNotEmpty()) {
                            Text("Possible misread (${cmp.possible.size})", fontWeight = FontWeight.SemiBold, color = status.warn)
                            cmp.possible.forEach {
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Note")
                                    androidx.compose.material3.Text(it.note, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Scanned")
                                    androidx.compose.material3.Text(it.scanned, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                                }
                            }
                        }
                    }
                },
                confirmButton = { Button(onClick = { close() }) { Text("Close") } },
            )
        }
    }
}

@Composable
private fun IdList(title: String, ids: List<String>, color: androidx.compose.ui.graphics.Color) {
    if (ids.isEmpty()) return
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("$title (${ids.size})", fontWeight = FontWeight.SemiBold, color = color)
        ids.forEach { androidx.compose.material3.Text(it, fontFamily = FontFamily.Monospace, fontSize = 14.sp) }
    }
}
