package com.authsignature.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.authsignature.app.container
import com.authsignature.app.data.ApiException
import com.authsignature.app.data.NoteTableReply
import com.authsignature.app.data.NoteTableRow
import com.authsignature.app.ocr.OnDeviceNoteReader
import com.authsignature.app.sound.Tone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File

private const val MAX_PAGES = 10

private data class PageState(val id: Int, val name: String, val status: String, val count: Int = 0, val error: String? = null)
private data class LineRow(val id: Int, val page: Int, val item: String, val delivered: String, val description: String)

// "12", "12,5", "1 200,5" and "1.200,5" are numbers; "12 pcs" or "?" are not. Same rules as the website.
private val QTY = Regex("""^\d+([.,]\d+)?$|^\d{1,3}([.,]\d{3})+([.,]\d+)?$""")
private val LAST_PART = Regex("""^(.*?)[.,](\d+)$""")

private fun quantity(text: String): Double? {
    val t = text.trim().replace(Regex("\\s"), "")
    if (!QTY.matches(t)) return null
    val m = LAST_PART.find(t)
    if (m != null && m.groupValues[2].length <= 2) return (m.groupValues[1].replace(Regex("[.,]"), "") + "." + m.groupValues[2]).toDouble()
    return t.replace(Regex("[.,]"), "").toDouble()
}

private fun norm(s: String) = s.uppercase().filter(Char::isLetterOrDigit)

private fun duplicateItems(rows: List<LineRow>): Set<String> =
    rows.map { norm(it.item) }.filter { it.isNotEmpty() }.groupingBy { it }.eachCount().filterValues { it > 1 }.keys

/** Joins the lines of one item number into one, adding up what was delivered; lines that are not numbers stay as they are. */
private fun mergeDuplicates(rows: List<LineRow>, newId: () -> Int): List<LineRow> {
    val out = mutableListOf<LineRow>()
    val at = HashMap<String, Int>()
    for (r in rows) {
        val k = norm(r.item)
        val q = quantity(r.delivered)
        val i = if (k.isNotEmpty()) at[k] else null
        val have = i?.let { quantity(out[it].delivered) }
        if (i != null && q != null && have != null) {
            val sum = Math.round((have + q) * 100) / 100.0
            val text = if (sum % 1.0 == 0.0) sum.toLong().toString() else sum.toString()
            out[i] = out[i].copy(delivered = text, description = out[i].description.ifEmpty { r.description })
        } else {
            if (k.isNotEmpty() && q != null && i == null) at[k] = out.size
            out.add(r.copy(id = newId(), page = 0))
        }
    }
    return out
}

/** The Notes tab: the same table, read by the AI service or, to try, by the phone alone (no AI, free, offline). */
@Composable
fun NotesTab() {
    var page by rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = page == 0, onClick = { page = 0 }, label = { Text("AI reader") })
            FilterChip(selected = page == 1, onClick = { page = 1 }, label = { Text("On this phone") })
        }
        if (page == 0) NotesScreen(onDevice = false) else NotesScreen(onDevice = true)
    }
}

/**
 * Photograph the pages of a delivery note (or choose several photos at once). Each page is read by the AI, and the
 * lines of all pages become one table: copy the item numbers alone, the delivered quantities alone, or everything.
 * Nothing is stored: the photos and the table are gone when the person leaves this screen.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NotesScreen(onDevice: Boolean = false) {
    val context = LocalContext.current
    val container = context.container
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    var pages by remember { mutableStateOf(listOf<PageState>()) }
    var rows by remember { mutableStateOf(listOf<LineRow>()) }
    var copied by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf<String?>(null) }
    var preparing by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<LineRow?>(null) }
    val images = remember { HashMap<Int, String>() } // each page's photo as base64, kept only to read it again
    val nextPage = remember { intArrayOf(1) }
    val nextRow = remember { intArrayOf(1) }
    val gate = remember { Semaphore(if (onDevice) 1 else 2) } // photos read at the same time
    // Either the AI service on the server, or the phone's own text recognizer: only the reading differs.
    val readImage: suspend (String) -> NoteTableReply = { image -> if (onDevice) OnDeviceNoteReader.read(image) else container.api.noteTableRead(image) }

    val photoFile = remember { File(context.cacheDir, "delivery-note.jpg") }
    val photoUri: Uri = remember { FileProvider.getUriForFile(context, "${context.packageName}.files", photoFile) }

    DisposableEffect(Unit) {
        onDispose {
            images.clear()
            runCatching { photoFile.delete() }
        }
    }

    fun patch(id: Int, change: (PageState) -> PageState) {
        pages = pages.map { if (it.id == id) change(it) else it }
    }

    // The lines of a page go where that page belongs, whatever order the pages finish reading in.
    fun place(page: Int, list: List<NoteTableRow>) {
        rows = rows.filter { it.page < page } +
            list.map { LineRow(nextRow[0]++, page, it.item, it.delivered, it.description) } +
            rows.filter { it.page > page }
    }

    fun read(id: Int) {
        val image = images[id] ?: return
        patch(id) { it.copy(status = "reading", error = null) }
        scope.launch {
            gate.withPermit {
                try {
                    val reply = readImage(image)
                    if (!reply.legible || reply.rows.isEmpty()) {
                        place(id, emptyList())
                        patch(id) { it.copy(status = "error", count = 0, error = "No table could be read from this photo. Take a clearer, straight-on photo of the note.") }
                        container.signal(Tone.Error)
                    } else {
                        place(id, reply.rows)
                        patch(id) { it.copy(status = "done", count = reply.rows.size, error = null) }
                    }
                } catch (e: ApiException) {
                    if (e.unauthorized) container.signOut() else patch(id) { it.copy(status = "error", error = e.message) }
                    container.signal(Tone.Error)
                } catch (e: Exception) {
                    patch(id) { it.copy(status = "error", error = "Could not read the delivery note. Try again.") }
                }
            }
            if (pages.none { it.status == "reading" }) container.signal(Tone.Finished)
        }
    }

    fun addImages(list: List<Pair<String, String>>) {
        val take = list.take(maxOf(0, MAX_PAGES - pages.size))
        note = if (list.size > take.size) "You can add at most 10 pages." else null
        val added = take.map { (name, base64) ->
            val id = nextPage[0]++
            images[id] = base64
            PageState(id, name, "reading")
        }
        pages = pages + added
        added.forEach { read(it.id) }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        if (uris.isNotEmpty()) {
            preparing = true
            scope.launch {
                val prepared = withContext(Dispatchers.IO) {
                    uris.take(MAX_PAGES).mapIndexedNotNull { i, uri ->
                        runCatching {
                            val temp = File(context.cacheDir, "note-pick-$i.jpg")
                            context.contentResolver.openInputStream(uri)!!.use { input -> temp.outputStream().use { input.copyTo(it) } }
                            val base64 = shrinkPhoto(temp)
                            temp.delete()
                            (uri.lastPathSegment ?: "Photo ${i + 1}") to base64
                        }.getOrNull()
                    }
                }
                preparing = false
                if (prepared.isEmpty()) note = "Not a supported photo" else addImages(prepared)
            }
        }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        if (taken) {
            preparing = true
            scope.launch {
                val base64 = runCatching { withContext(Dispatchers.Default) { shrinkPhoto(photoFile) } }.getOrNull()
                runCatching { photoFile.delete() }
                preparing = false
                if (base64 != null) addImages(listOf("Camera" to base64)) else note = "Not a supported photo"
            }
        } else {
            runCatching { photoFile.delete() }
        }
    }

    fun copy(what: String, text: String) {
        clipboard.setText(AnnotatedString(text))
        copied = what
        container.signal(Tone.Done)
        scope.launch {
            delay(1500)
            if (copied == what) copied = null
        }
    }

    fun clearAll() {
        images.clear()
        pages = emptyList()
        rows = emptyList()
        note = null
    }

    val dups = duplicateItems(rows)
    val odd = rows.count { it.delivered.isNotBlank() && quantity(it.delivered) == null }
    val total = rows.sumOf { quantity(it.delivered) ?: 0.0 }
    val totalText = Math.round(total * 100).let { if (it % 100 == 0L) (it / 100).toString() else (it / 100.0).toString() }
    val reading = preparing || pages.any { it.status == "reading" }
    val column = { pick: (LineRow) -> String -> rows.joinToString("\n") { pick(it) } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AppCard {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { picker.launch("image/*") }, enabled = pages.size < MAX_PAGES && !preparing, shape = RoundedCornerShape(12.dp), modifier = Modifier.weight(1f).height(48.dp)) { Text("Choose photos", maxLines = 1) }
                    OutlinedButton(
                        onClick = {
                            runCatching { photoFile.delete() }
                            camera.launch(photoUri)
                        },
                        enabled = pages.size < MAX_PAGES && !preparing,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f).height(48.dp),
                    ) { Text("Take photo", maxLines = 1) }
                }
                Text(
                    "Choose all the pages of the note at once. Each page is read, and the lines are joined into one table in page order.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (onDevice) {
                    Text(
                        "Read on this phone without AI: free and works offline, but it can misread, so check every line.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                note?.let { ErrorNote(it) }
                if (reading) Text("Reading the delivery note…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)

                pages.forEachIndexed { i, p ->
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Page ${i + 1}", fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            when (p.status) {
                                "reading" -> Text("Reading…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                "done" -> Pill("${p.count} lines", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                else -> TextButton(onClick = { read(p.id) }) { Text("Read again") }
                            }
                            TextButton(
                                onClick = {
                                    images.remove(p.id)
                                    pages = pages.filter { it.id != p.id }
                                    rows = rows.filter { it.page != p.id }
                                },
                                enabled = p.status != "reading",
                            ) { Text("Remove", color = MaterialTheme.colorScheme.error) }
                        }
                        if (p.status == "error") p.error?.let { ErrorNote(it) }
                    }
                }
                if (pages.isNotEmpty()) TextButton(onClick = { clearAll() }, enabled = !reading) { Text("Clear all", color = MaterialTheme.colorScheme.error) }
            }
        }

        if (rows.isNotEmpty()) {
            AppCard {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("${rows.size} lines", fontWeight = FontWeight.SemiBold)
                            Text("Total delivered: $totalText", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        OutlinedButton(onClick = { copy("table", rows.joinToString("\n") { "${it.item}\t${it.delivered}\t${it.description}" }) }, shape = RoundedCornerShape(10.dp)) {
                            Text(if (copied == "table") "Copied" else "Copy table")
                        }
                    }
                    if (dups.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("The same item number appears on more than one line.", color = status.warn, style = MaterialTheme.typography.bodySmall)
                            OutlinedButton(onClick = { rows = mergeDuplicates(rows) { nextRow[0]++ } }, shape = RoundedCornerShape(10.dp)) { Text("Merge duplicate items") }
                        }
                    }
                    if (odd > 0) Text("$odd lines have a delivered quantity that is not a number. Check them.", color = status.warn, style = MaterialTheme.typography.bodySmall)

                    // Column headings, each with its own Copy: the item numbers alone, the delivered alone, the descriptions alone.
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Column(Modifier.weight(1.3f)) {
                            Text("Item number", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            TextButton(onClick = { copy("item", column { it.item }) }) { Text(if (copied == "item") "Copied" else "Copy", maxLines = 1) }
                        }
                        Column(Modifier.weight(0.8f), horizontalAlignment = Alignment.End) {
                            Text("Delivered", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            TextButton(onClick = { copy("delivered", column { it.delivered }) }) { Text(if (copied == "delivered") "Copied" else "Copy", maxLines = 1) }
                        }
                        Column(Modifier.weight(1.3f)) {
                            Text("Description", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            TextButton(onClick = { copy("description", column { it.description }) }) { Text(if (copied == "description") "Copied" else "Copy", maxLines = 1) }
                        }
                    }
                    rows.forEach { r ->
                        val dup = norm(r.item) in dups
                        val bad = r.delivered.isNotBlank() && quantity(r.delivered) == null
                        Row(
                            Modifier.fillMaxWidth().clickable { editing = r }.background(if (dup) status.warn.copy(alpha = 0.15f) else androidx.compose.ui.graphics.Color.Transparent).padding(vertical = 6.dp, horizontal = 2.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.Top,
                        ) {
                            androidx.compose.material3.Text(r.item.ifEmpty { "–" }, fontFamily = FontFamily.Monospace, fontSize = 13.sp, modifier = Modifier.weight(1.3f))
                            androidx.compose.material3.Text(
                                r.delivered.ifEmpty { "–" },
                                fontFamily = FontFamily.Monospace,
                                fontSize = 13.sp,
                                textAlign = TextAlign.End,
                                color = if (bad) MaterialTheme.colorScheme.error else androidx.compose.ui.graphics.Color.Unspecified,
                                modifier = Modifier.weight(0.8f),
                            )
                            androidx.compose.material3.Text(r.description, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1.3f))
                        }
                    }
                    OutlinedButton(
                        onClick = { editing = LineRow(nextRow[0]++, rows.lastOrNull()?.page ?: 0, "", "", "").also { rows = rows + it } },
                        shape = RoundedCornerShape(10.dp),
                    ) { Text("Add line") }
                    Text("Tap a line to fix a mistake.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        if (pages.isEmpty() && !preparing) {
            Text("No delivery note read yet. Choose photos or take one to start.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(8.dp))
        }
        Text("Nothing is saved: the photos and the table are gone when you leave this page.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }

    editing?.let { line ->
        var item by remember(line.id) { mutableStateOf(line.item) }
        var delivered by remember(line.id) { mutableStateOf(line.delivered) }
        var description by remember(line.id) { mutableStateOf(line.description) }
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Edit line") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = item, onValueChange = { item = it.take(40) }, label = { Text("Item number") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = delivered, onValueChange = { delivered = it.take(20) }, label = { Text("Delivered") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = description, onValueChange = { description = it.take(120) }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth())
                    TextButton(onClick = {
                        rows = rows.filter { it.id != line.id }
                        editing = null
                    }) { Text("Remove line", color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                Button(onClick = {
                    rows = rows.map { if (it.id == line.id) it.copy(item = item.trim(), delivered = delivered.trim(), description = description.trim()) else it }
                    editing = null
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { editing = null }) { Text("Cancel") } },
        )
    }
}
