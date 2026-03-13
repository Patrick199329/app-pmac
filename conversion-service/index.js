const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const app = express();
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const INTERNAL_TOKEN = process.env.INTERNAL_CONVERTER_TOKEN;

// Auth Middleware
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log(`[${new Date().toISOString()}] Request: ${req.method} ${req.path}`);

    if (!INTERNAL_TOKEN || authHeader !== `Bearer ${INTERNAL_TOKEN}`) {
        console.warn("Unauthorized request attempt");
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

/**
 * Pre-processes word/document.xml to eliminate the root causes of blank pages in LibreOffice.
 *
 * ROOT CAUSE: In DOCX, sections are delimited by <w:sectPr> inside an empty <w:p>.
 * That empty paragraph is purely structural in Word (invisible). LibreOffice, however,
 * renders each of those paragraphs as a full blank page with the header/footer of its section.
 *
 * STRATEGY:
 * 1. Remove <w:p> elements that have <w:sectPr> but NO <w:r> content runs — these are the
 *    "ghost" section-delimiter paragraphs that LibreOffice turns into blank pages.
 *    NOTE: The final <w:sectPr> that is a direct child of <w:body> (not inside <w:p>) is
 *    the document's main section and must never be touched.
 * 2. Normalize [PLACEHOLDER] → {PLACEHOLDER} for single-pass docxtemplater.
 * 3. Replace non-Calibri fonts with Calibri.
 */
function removeEmptySectionParagraphs(xmlContent) {
    // This regex finds <w:p> elements (with optional attributes) that:
    //   - may have a <w:pPr> block containing a <w:sectPr>
    //   - do NOT have any <w:r> runs (actual content)
    // We remove these paragraphs entirely. Their section properties are effectively
    // absorbed by the surrounding document structure, which LibreOffice handles correctly.
    //
    // The regex is intentionally strict: it only matches when there is NO <w:r in the paragraph,
    // ensuring we never accidentally remove paragraphs with real content.
    let cleaned = xmlContent;
    let previousLength;

    // Iterate until no more changes (handles adjacent empty section paragraphs)
    do {
        previousLength = cleaned.length;
        cleaned = cleaned.replace(
            /<w:p(?:\s[^>]*)?>(?!\s*<w:r[\s>])(?:[^<]|<(?!\/w:p>))*?<w:sectPr>[\s\S]*?<\/w:sectPr>(?:[^<]|<(?!\/w:p>))*?<\/w:p>/g,
            (match) => {
                // Double-check: only remove if truly no content runs
                if (/<w:r[\s>]/.test(match)) return match;
                console.log(`[preprocessor] Removed empty section-break paragraph (${match.length} chars)`);
                return '';
            }
        );
    } while (cleaned.length !== previousLength);

    return cleaned;
}

/**
 * Full DOCX XML pre-processor:
 * - Removes blank-page-causing empty paragraphs with section breaks
 * - Normalizes [PLACEHOLDER] -> {PLACEHOLDER}
 * - Replaces Trebuchet MS / Times New Roman with Calibri
 */
function preprocessDocxXml(zip) {
    // --- document.xml: full treatment ---
    const docFile = zip.file('word/document.xml');
    if (docFile) {
        let content = docFile.asText();

        // 1. Remove empty section-break paragraphs (root cause of blank pages)
        content = removeEmptySectionParagraphs(content);

        // 2. Normalize placeholders for single-pass docxtemplater
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // 3. Font replacement
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        zip.file('word/document.xml', content);
    }

    // --- headers and footers: placeholder + font ---
    const auxFiles = [
        'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
        'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
    ];
    auxFiles.forEach(filename => {
        const file = zip.file(filename);
        if (!file) return;
        let content = file.asText();
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');
        zip.file(filename, content);
    });

    // --- styles.xml: font replacement only ---
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
        let stylesContent = stylesFile.asText();
        stylesContent = stylesContent.replace(/Trebuchet MS/g, 'Calibri');
        stylesContent = stylesContent.replace(/Times New Roman/g, 'Calibri');
        zip.file('word/styles.xml', stylesContent);
    }
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const username = (req.body.username || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Processing for: ${username}, Date: ${currentDate} (Source: ${req.body.currentDate ? 'Request' : 'Fallback'})`);

        // 1. Load the docx file as zip
        const zip = new PizZip(req.file.buffer);

        // 2. Pre-process DOCX XML (remove blank pages, fix fonts, normalize placeholders)
        preprocessDocxXml(zip);

        // 3. Single-pass docxtemplater render
        const doc = new Docxtemplater(zip, {
            linebreaks: true,
        });

        const data = {
            NOME: username,
            nome: username.toLowerCase(),
            NAME: username.toUpperCase(),
            DATA: currentDate,
            data: currentDate,
            Data: currentDate,
            DATE: currentDate,
            date: currentDate,
        };

        doc.render(data);

        // 4. Get the final modified DOCX buffer
        const modifiedDocxBuffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        // 5. Convert DOCX -> PDF via LibreOffice
        libre.convert(modifiedDocxBuffer, '.pdf', undefined, (err, pdfBuffer) => {
            if (err) {
                console.error(`Error converting file: ${err}`);
                return res.status(500).json({ error: 'Conversion failed' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
            res.send(pdfBuffer);
        });
    } catch (error) {
        console.error(`Error processing document: ${error}`);
        res.status(500).json({ error: 'Document processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Conversion service running on port ${PORT}`);
});
