package com.authsignature.app.ocr

import com.authsignature.app.data.NoteTableRow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The parser works on word positions, so these tests lay words out the way a printed table looks: every character is
 * 10 px wide, a line is 20 px high, words of one cell are one space (10 px) apart, and columns start at given x.
 */
class NoteTableParserTest {
    /** One printed line: cells at (x, text). A cell of several words is laid out word by word, 10 px apart. */
    private fun line(y: Int, vararg cells: Pair<Int, String>, jitter: Int = 0): List<OcrWord> =
        cells.flatMap { (x, text) ->
            var at = x
            text.split(" ").mapIndexed { i, w ->
                val left = at
                at += w.length * 10 + 10
                // A little vertical wobble, as in a photo taken by hand.
                val dy = if (jitter == 0) 0 else if ((i + x) % 2 == 0) jitter else -jitter
                OcrWord(w, left, y + dy, left + w.length * 10, y + 20 + dy)
            }
        }

    private fun rows(vararg l: List<OcrWord>) = NoteTableParser.parse(l.toList().flatten())
    private fun row(item: String, delivered: String, description: String = "") = NoteTableRow(item, delivered, description)

    @Test
    fun swedishHeaderPicksTheDeliveredColumnNotTheOrderedOne() {
        val result = rows(
            line(100, 20 to "Art.nr", 200 to "Benämning", 520 to "Beställt", 640 to "Levererat", 780 to "Rest"),
            line(140, 20 to "AB-100", 200 to "Bult M8 zink", 540 to "10", 680 to "8", 800 to "2"),
            line(180, 20 to "CD-2001", 200 to "Mutter M8", 540 to "100", 680 to "100", 800 to "0"),
        )
        assertEquals(listOf(row("AB-100", "8", "Bult M8 zink"), row("CD-2001", "100", "Mutter M8")), result)
    }

    @Test
    fun englishHeader() {
        val result = rows(
            line(50, 10 to "Item no.", 160 to "Description", 480 to "Ordered", 600 to "Delivered"),
            line(90, 10 to "X-44", 160 to "Gasket", 500 to "5", 640 to "5"),
        )
        assertEquals(listOf(row("X-44", "5", "Gasket")), result)
    }

    @Test
    fun aSingleQuantityColumnCalledAntalIsUsed() {
        val result = rows(
            line(50, 10 to "Artikelnr", 200 to "Benämning", 500 to "Antal"),
            line(90, 10 to "7788-1", 200 to "Packning", 520 to "12"),
        )
        assertEquals(listOf(row("7788-1", "12", "Packning")), result)
    }

    @Test
    fun linesThatWobbleUpAndDownAreStillOneRow() {
        val result = rows(
            line(100, 20 to "Art.nr", 200 to "Benämning", 520 to "Levererat", jitter = 3),
            line(140, 20 to "AB-100", 200 to "Bult M8 zink", 540 to "8", jitter = 4),
            line(180, 20 to "CD-2001", 200 to "Mutter", 540 to "3", jitter = 4),
        )
        assertEquals(listOf(row("AB-100", "8", "Bult M8 zink"), row("CD-2001", "3", "Mutter")), result)
    }

    @Test
    fun totalsAndPageNumbersAreNotLines() {
        val result = rows(
            line(50, 10 to "Art.nr", 200 to "Benämning", 500 to "Levererat"),
            line(90, 10 to "AB-100", 200 to "Bult", 520 to "8"),
            line(130, 10 to "Summa", 520 to "8"),
            line(170, 10 to "Sida 1 av 2"),
        )
        assertEquals(listOf(row("AB-100", "8", "Bult")), result)
    }

    @Test
    fun aWrappedDescriptionContinuesTheRowAbove() {
        val result = rows(
            line(50, 10 to "Art.nr", 200 to "Benämning", 500 to "Levererat"),
            line(90, 10 to "AB-100", 200 to "Bult M8 zink", 520 to "8"),
            line(115, 200 to "kl 8.8 DIN 933"),
            line(160, 10 to "CD-2001", 200 to "Mutter", 520 to "3"),
        )
        assertEquals(listOf(row("AB-100", "8", "Bult M8 zink kl 8.8 DIN 933"), row("CD-2001", "3", "Mutter")), result)
    }

    @Test
    fun aUnitAfterTheQuantityIsLeftOut() {
        val result = rows(
            line(50, 10 to "Art.nr", 200 to "Benämning", 500 to "Levererat"),
            line(90, 10 to "AB-100", 200 to "Bult", 500 to "12 st"),
            line(130, 10 to "CD-2001", 200 to "Rör", 500 to "1 200,5 m"),
        )
        assertEquals(listOf(row("AB-100", "12", "Bult"), row("CD-2001", "1 200,5", "Rör")), result)
    }

    @Test
    fun withoutAHeaderEachLineIsReadByItsShape() {
        val result = rows(
            line(50, 10 to "AB-100", 150 to "Bult M8 zink", 450 to "8"),
            line(90, 10 to "CD-2001", 150 to "Mutter M8", 450 to "10", 560 to "9"),
            line(130, 10 to "EF-300", 150 to "Bricka", 450 to "20", 560 to "18", 660 to "2"),
        )
        // One number: that one. Two (ordered, delivered): the last. Three (ordered, delivered, remaining): the middle.
        assertEquals(listOf(row("AB-100", "8", "Bult M8 zink"), row("CD-2001", "9", "Mutter M8"), row("EF-300", "18", "Bricka")), result)
    }

    @Test
    fun withoutAHeaderANumberOnlyLineAndPlainTextAreSkipped() {
        val result = rows(
            line(50, 10 to "Följesedel nr 5521", 400 to "Datum 2026-11-02"),
            line(90, 10 to "AB-100", 150 to "Bult", 450 to "8"),
            line(130, 10 to "Tack för ordern"),
        )
        assertEquals(listOf(row("AB-100", "8", "Bult")), result)
    }

    @Test
    fun aPageThatIsNotATableGivesNothing() {
        assertTrue(rows(line(50, 10 to "Hej hopp", 200 to "och hå")).isEmpty())
        assertTrue(NoteTableParser.parse(emptyList()).isEmpty())
    }

    @Test
    fun quantitiesRightAlignedUnderACentredHeaderStayInTheirColumn() {
        // "Levererat" is wider than the numbers under it, which hug its right side.
        val result = rows(
            line(50, 10 to "Art.nr", 200 to "Benämning", 480 to "Beställt", 640 to "Levererat"),
            line(90, 10 to "AB-100", 200 to "Bult", 560 to "100", 740 to "95"),
        )
        assertEquals(listOf(row("AB-100", "95", "Bult")), result)
    }
}
