const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { PDFDocument } = require('pdf-lib');

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
 * Detects if a PDF page is blank by inspecting its content streams.
 * A page is considered blank if it has no content stream or the stream is effectively empty.
 */
async function isPageBlank(pdfDoc, pageIndex) {
    try {
        const page = pdfDoc.getPage(pageIndex);
        const { width, height } = page.getSize();

        // Check for content streams - blank pages have none or empty ones
        const pageDict = page.node;
        const contents = pageDict.get(pdfDoc.context.obj('Contents'));
        if (!contents) return true;

        // Try to get content stream bytes
        const contentStreams = [];
        if (contents.constructor.name === 'PDFArray') {
            for (let i = 0; i < contents.size(); i++) {
                const ref = contents.get(i);
                const stream = pdfDoc.context.lookup(ref);
                if (stream && stream.constructor.name === 'PDFRawStream') {
                    contentStreams.push(Buffer.from(stream.contents).toString('latin1'));
                }
            }
        } else if (contents.constructor.name === 'PDFRawStream') {
            contentStreams.push(Buffer.from(contents.contents).toString('latin1'));
        } else {
            // If indirectly referenced
            const ref = contents;
            const stream = pdfDoc.context.lookup(ref);
            if (stream && stream.constructor.name === 'PDFRawStream') {
                contentStreams.push(Buffer.from(stream.contents).toString('latin1'));
            }
        }

        const combinedContent = contentStreams.join('').trim();

        // PDF operators that draw content: Td, TD, Tj, TJ, ', ", cm, re, f, F, S, s, B, b, n, Do, RG, rg
        // If there are no drawing operators, the page is blank
        const hasContent = /[A-Za-z]/.test(combinedContent.replace(/^\s*$/, ''));
        if (!hasContent) return true;

        // More aggressive: check if any text or drawing commands exist
        const drawingOps = /\b(Tj|TJ|'|"|cm|re\s+f|RG|rg|K|k|Do)\b/;
        return !drawingOps.test(combinedContent);
    } catch (e) {
        // On error, assume it's not blank to be safe
        return false;
    }
}

/**
 * Removes blank pages from a PDF buffer.
 */
async function removeBlankPages(pdfBuffer) {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const blankIndices = [];

    for (let i = 0; i < pageCount; i++) {
        if (await isPageBlank(pdfDoc, i)) {
            blankIndices.push(i);
        }
    }

    if (blankIndices.length === 0) {
        console.log(`[${new Date().toISOString()}] No blank pages found.`);
        return pdfBuffer;
    }

    console.log(`[${new Date().toISOString()}] Removing ${blankIndices.length} blank page(s): [${blankIndices.map(i => i + 1).join(', ')}]`);

    // Remove in reverse order so indices stay valid
    for (let i = blankIndices.length - 1; i >= 0; i--) {
        pdfDoc.removePage(blankIndices[i]);
    }

    return Buffer.from(await pdfDoc.save());
}

/**
 * Pre-processes DOCX XML to:
 * 1. Normalize [PLACEHOLDER] -> {PLACEHOLDER} (for docxtemplater)
 * 2. Replace Trebuchet MS font with Calibri (at 14pt for headings)
 */
function preprocessDocxXml(zip) {
    const xmlFiles = [
        'word/document.xml',
        'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
        'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
    ];

    xmlFiles.forEach(filename => {
        const file = zip.file(filename);
        if (!file) return;
        let content = file.asText();

        // 1. Normalize [PLACEHOLDER] -> {PLACEHOLDER} for single-pass templating
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // 2. Replace Trebuchet MS (and common heading fonts) with Calibri
        //    These appear in w:rFonts attributes
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        zip.file(filename, content);
    });

    // 3. Fix heading font sizes in styles - ensure heading styles use Calibri 14pt (280 half-points)
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
        let stylesContent = stylesFile.asText();

        // Replace Trebuchet MS in styles with Calibri
        stylesContent = stylesContent.replace(/Trebuchet MS/g, 'Calibri');
        stylesContent = stylesContent.replace(/Times New Roman/g, 'Calibri');

        zip.file('word/styles.xml', stylesContent);
    }
}

app.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const username = (req.body.username || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Processing for: ${username}, Date: ${currentDate} (Source: ${req.body.currentDate ? 'Request' : 'Fallback'})`);

        // 1. Load the docx file as zip
        const zip = new PizZip(req.file.buffer);

        // 2. Pre-process DOCX XML (normalize placeholders + fix fonts)
        preprocessDocxXml(zip);

        // 3. Single-pass docxtemplater render with standard {PLACEHOLDER} delimiters
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
        libre.convert(modifiedDocxBuffer, '.pdf', undefined, async (err, pdfBuffer) => {
            if (err) {
                console.error(`Error converting file: ${err}`);
                return res.status(500).json({ error: 'Conversion failed' });
            }

            try {
                // 6. Post-process PDF: remove blank pages introduced by LibreOffice
                const cleanedPdfBuffer = await removeBlankPages(pdfBuffer);
                console.log(`[${new Date().toISOString()}] PDF ready. Pages: ${(await PDFDocument.load(cleanedPdfBuffer)).getPageCount()}`);

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
                res.send(cleanedPdfBuffer);
            } catch (postErr) {
                console.error(`Error post-processing PDF: ${postErr}`);
                // Fall back to sending the original PDF if post-processing fails
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
                res.send(pdfBuffer);
            }
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
