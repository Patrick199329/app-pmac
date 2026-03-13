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
 * Pre-processes DOCX XML to:
 * 1. Normalize [PLACEHOLDER] -> {PLACEHOLDER} (for docxtemplater single-pass)
 * 2. Replace non-Calibri fonts (Trebuchet MS, Times New Roman) with Calibri
 * 3. Fix section break types: oddPage/evenPage -> nextPage
 *    LibreOffice inserts a compensatory blank page for odd/even section breaks,
 *    which is why the PDF has 2 extra pages. nextPage avoids this.
 * 4. Remove trailing empty paragraphs that LibreOffice renders as blank pages
 */
function preprocessDocxXml(zip) {
    // --- Process document.xml ---
    const docFile = zip.file('word/document.xml');
    if (docFile) {
        let content = docFile.asText();

        // 1. Normalize [PLACEHOLDER] -> {PLACEHOLDER}
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // 2. Font replacement: Trebuchet MS and Times New Roman -> Calibri
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        // 3. Fix section break types that cause LibreOffice to add blank pages:
        //    oddPage and evenPage force content to start on odd/even page, inserting
        //    a blank compensatory page. nextPage simply starts a new page without blank.
        content = content.replace(
            /(<w:type\s+w:val=")(?:oddPage|evenPage)(")/g,
            '$1nextPage$2'
        );

        // 4. Remove sequences of empty paragraphs (no text runs) at the end of the body
        //    These are the other common cause of extra blank pages in LibreOffice.
        //    We target <w:p> elements that contain ONLY <w:pPr> (no <w:r> runs).
        //    The regex is conservative: only strips truly empty paragraphs.
        content = content.replace(
            /(<w:p\b[^>]*>)\s*(<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*?<\/w:pPr>)?\s*(<\/w:p>\s*){2,}(<\/w:body>)/g,
            (match, p1, p2, p3, closing) => {
                // Keep just one trailing empty paragraph before </w:body>
                return (p2 ? `${p1}${p2}</w:p>` : `${p1}</w:p>`) + closing;
            }
        );

        zip.file('word/document.xml', content);
    }

    // --- Process headers and footers ---
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

    // --- Process styles.xml (font replacement only) ---
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

        // 2. Pre-process DOCX XML (placeholders, fonts, section breaks, empty paragraphs)
        preprocessDocxXml(zip);

        // 3. Single-pass docxtemplater render with standard {PLACEHOLDER} delimiters.
        //    paragraphLoop intentionally disabled — template has no loop tags.
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
