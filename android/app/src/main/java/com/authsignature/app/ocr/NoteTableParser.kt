package com.authsignature.app.ocr

import com.authsignature.app.data.NoteTableRow

/** One word the text recognizer found, with where it sits in the photo (pixels). */
data class OcrWord(val text: String, val left: Int, val top: Int, val right: Int, val bottom: Int) {
    val height: Int get() = bottom - top
    val cy: Double get() = (top + bottom) / 2.0
}

private class Cell(val text: String, val left: Int, val right: Int) {
    val cx: Double get() = (left + right) / 2.0
}

private class Line(val cells: List<Cell>)

private enum class Col { Item, Delivered, Description, Other }

private class Header(val index: Int, val cells: List<Cell>, val item: Cell, val delivered: Cell, val description: Cell?)

/**
 * Builds the delivery note table (item number, delivered quantity, description) from the positions of the words
 * the phone's own text recognizer found. No AI is involved, so this only uses the layout:
 *
 *  1. words at the same height form a line, and words close together on a line form a cell;
 *  2. a header line ("Art.nr ... Levererat ...") says which column is which; without one, each line is read by its
 *     shape (an item number, some text, one or more quantities);
 *  3. total lines, page numbers and the like are skipped, and a line of text under a row continues its description.
 *
 * It is a best effort on printed tables: the person checks the lines before using them.
 */
object NoteTableParser {
    fun parse(words: List<OcrWord>): List<NoteTableRow> {
        val clean = words.filter { it.text.isNotBlank() && it.right > it.left && it.bottom > it.top }
        if (clean.size < 3) return emptyList()
        val lines = toLines(clean)
        val header = findHeader(lines)
        return if (header != null) withHeader(lines, header) else withoutHeader(lines)
    }

    // --- lines and cells ---------------------------------------------------------------------------------

    private fun toLines(words: List<OcrWord>): List<Line> {
        val medianH = words.map { it.height }.sorted()[words.size / 2].coerceAtLeast(4)
        val tolerance = maxOf(3.0, medianH * 0.55)
        val groups = mutableListOf<MutableList<OcrWord>>()
        val means = mutableListOf<Double>()
        for (w in words.sortedBy { it.cy }) {
            // Sorted by height, so a word belongs to the line just before it or starts a new one.
            if (groups.isNotEmpty() && kotlin.math.abs(w.cy - means.last()) <= tolerance) {
                groups.last().add(w)
                means[means.lastIndex] = groups.last().map { it.cy }.average()
            } else {
                groups.add(mutableListOf(w))
                means.add(w.cy)
            }
        }
        val gap = medianH * 1.1
        return groups.map { g ->
            val sorted = g.sortedBy { it.left }
            val cells = mutableListOf<Cell>()
            var text = StringBuilder(sorted[0].text)
            var left = sorted[0].left
            var right = sorted[0].right
            for (w in sorted.drop(1)) {
                if (w.left - right <= gap) {
                    text.append(' ').append(w.text)
                    right = maxOf(right, w.right)
                } else {
                    cells.add(Cell(text.toString(), left, right))
                    text = StringBuilder(w.text)
                    left = w.left
                    right = w.right
                }
            }
            cells.add(Cell(text.toString(), left, right))
            Line(cells)
        }
    }

    // --- the header --------------------------------------------------------------------------------------

    private fun key(text: String) = text.lowercase().filter { it.isLetter() }

    private val ITEM_KEYS = listOf("artnr", "artikelnr", "artikelnummer", "artikel", "varunr", "varunummer", "itemno", "itemnumber", "item", "partno", "partnumber", "sku", "article", "artno", "produktnr", "prodnr")
    private val DELIVERED_KEYS = listOf("levererat", "levererad", "levererade", "delivered", "geliefert", "shipped", "antallev", "levantal", "levmängd", "levmangd", "qtydel", "deliveredqty")
    private val QUANTITY_KEYS = listOf("antal", "qty", "quantity", "menge", "kvantitet")
    private val DESCRIPTION_KEYS = listOf("benämning", "benamning", "beskrivning", "description", "bezeichnung", "text", "produkt", "product", "godsbeskrivning")

    private fun isDelivered(k: String) = DELIVERED_KEYS.any { k.contains(it) } || k == "lev"
    private fun isItem(k: String) = ITEM_KEYS.any { k.contains(it) }

    private fun findHeader(lines: List<Line>): Header? {
        for ((i, line) in lines.withIndex()) {
            val item = line.cells.firstOrNull { isItem(key(it.text)) } ?: continue
            val delivered = line.cells.firstOrNull { it !== item && isDelivered(key(it.text)) }
                ?: line.cells.firstOrNull { it !== item && key(it.text) in QUANTITY_KEYS }
                ?: continue
            val description = line.cells.firstOrNull { it !== item && it !== delivered && DESCRIPTION_KEYS.any { k -> key(it.text).contains(k) } }
            return Header(i, line.cells, item, delivered, description)
        }
        return null
    }

    // How far the cell is from the header cell sideways: 0 when they overlap.
    private fun sideways(c: Cell, h: Cell) = maxOf(0, maxOf(c.left, h.left) - minOf(c.right, h.right))

    private fun columnOf(c: Cell, h: Header): Col {
        val nearest = h.cells.minWith(compareBy<Cell>({ sideways(c, it) }, { kotlin.math.abs(c.cx - it.cx) }))
        return when {
            nearest === h.item -> Col.Item
            nearest === h.delivered -> Col.Delivered
            nearest === h.description -> Col.Description
            else -> Col.Other
        }
    }

    private val STOP_WORDS = listOf("summa", "delsumma", "total", "totalt", "sum", "frakt", "vikt", "antal kolli", "kolli", "sida", "page", "moms", "netto", "brutto", "signatur", "datum", "mottagare", "avsändare")

    private fun isNoise(line: Line): Boolean {
        val first = line.cells.first().text.lowercase()
        return STOP_WORDS.any { first.startsWith(it) }
    }

    private fun withHeader(lines: List<Line>, h: Header): List<NoteTableRow> {
        val out = mutableListOf<NoteTableRow>()
        for (line in lines.drop(h.index + 1)) {
            if (isNoise(line)) continue
            val item = StringBuilder()
            val delivered = StringBuilder()
            val description = StringBuilder()
            for (c in line.cells) {
                val target = when (columnOf(c, h)) {
                    Col.Item -> item
                    Col.Delivered -> delivered
                    Col.Description -> description
                    Col.Other -> null
                } ?: continue
                if (target.isNotEmpty()) target.append(' ')
                target.append(c.text)
            }
            val itemText = item.toString().trim()
            val deliveredText = numericPart(delivered.toString()) ?: delivered.toString().trim()
            val descText = description.toString().trim()
            when {
                itemText.isEmpty() && deliveredText.isEmpty() ->
                    // A line of text under a row: the rest of its description.
                    if (descText.isNotEmpty() && out.isNotEmpty()) out[out.lastIndex] = out.last().let { it.copy(description = (it.description + " " + descText).trim()) }
                itemText.isNotEmpty() && itemText.none { it.isDigit() } && deliveredText.isEmpty() -> Unit
                itemText.isEmpty() && numericPart(deliveredText) == null -> Unit
                else -> out.add(NoteTableRow(itemText, deliveredText, descText))
            }
        }
        return out
    }

    // --- no header: read each line by its shape -----------------------------------------------------------

    private val ITEM_LIKE = Regex("""^(?=.*\d)[A-Za-z0-9ÅÄÖåäö][A-Za-z0-9ÅÄÖåäö\-./]{2,}$""")
    private val NUMBER = Regex("""^(\d[\d\s.,]*)(?:\s*[A-Za-zåäöÅÄÖ.]{1,6})?$""")

    /** The number in "12", "1 200,5" or "12 st" (without the unit), or null if the text is not a quantity. */
    private fun numericPart(text: String): String? {
        val m = NUMBER.matchEntire(text.trim()) ?: return null
        return m.groupValues[1].trim().trimEnd('.', ',').ifEmpty { null }
    }

    private fun itemLike(text: String) = ITEM_LIKE.matches(text) && (text.any { it.isLetter() } || '-' in text || '.' in text || text.length >= 5)

    private fun withoutHeader(lines: List<Line>): List<NoteTableRow> {
        val out = mutableListOf<NoteTableRow>()
        for (line in lines) {
            if (isNoise(line)) continue
            val at = line.cells.indexOfFirst { itemLike(it.text) }
            if (at < 0) continue
            val after = line.cells.drop(at + 1)
            val numbers = after.filter { numericPart(it.text) != null }
            if (numbers.isEmpty()) continue
            // One quantity: that one. Ordered and delivered: the last. Ordered, delivered and remaining: the middle one.
            val chosen = when (numbers.size) {
                1 -> numbers[0]
                2 -> numbers[1]
                else -> numbers[numbers.size - 2]
            }
            val description = after.filter { numericPart(it.text) == null }.joinToString(" ") { it.text }
            out.add(NoteTableRow(line.cells[at].text, numericPart(chosen.text) ?: chosen.text, description))
        }
        return out
    }
}
