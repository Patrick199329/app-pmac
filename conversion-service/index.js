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
 * Senior-level Blank Page Detection
 * Analyzes the content stream of a page to determine if it's effectively empty.
 */
async function isPageBlank(pdfDoc, pageIndex) {
    try {
        const pageCount = pdfDoc.getPageCount();
        
        // PROTECTION: Never remove the first page (Cover) or the last page (Back Cover)
        if (pageIndex === 0 || pageIndex === pageCount - 1) return false;

        const page = pdfDoc.getPage(pageIndex);
        const { width, height } = page.getSize();
        const pageDict = page.node;
        const contents = pageDict.get(pdfDoc.context.obj('Contents'));
        
        if (!contents) return true;

        // Extract content streams
        let contentStr = '';
        if (contents.constructor.name === 'PDFArray') {
            for (let i = 0; i < contents.size(); i++) {
                const stream = pdfDoc.context.lookup(contents.get(i));
                if (stream && stream.contents) contentStr += Buffer.from(stream.contents).toString('latin1');
            }
        } else {
            const stream = pdfDoc.context.lookup(contents);
            if (stream && stream.contents) contentStr = Buffer.from(stream.contents).toString('latin1');
        }

        const trimmed = contentStr.trim();
        if (!trimmed) return true;

        // BLANKNESS THRESHOLD:
        // A page is "Blank" if it only contains boilerplate operators and NO significant text/images.
        // Significant text operators: Tj, TJ, ', "
        // Significant image/drawing operators: Do (images), re f (rect fill), S (stroke)
        const hasText = /\b(Tj|TJ|'|")\b/.test(trimmed);
        const hasImagesOrGraphics = /\b(Do|re f|S)\b/.test(trimmed);

        // If it has NO text and NO significant graphics, it's blank.
        // We exclude simple path commands like 'm' (move) or 'l' (line) which might be header/footer lines.
        if (!hasText && !hasImagesOrGraphics) {
            // Check for color settings which might just be for the header/footer
            // rg, rg, RG, RG, k, K
            return true; 
        }

        // Additional check: Content stream length
        // A page with real content usually has > 200 characters of PDF operators.
        // If it's < 150 chars, it's almost certainly just a header/footer reference.
        if (trimmed.length < 150) return true;

        return false;
    } catch (e) {
        console.warn(`[PDF Processor] Error checking page ${pageIndex}: ${e.message}`);
        return false; // Safely assume not blank on error
    }
}

/**
 * Removes blank pages from a PDF buffer.
 */
async function removeBlankPages(pdfBuffer) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        const pagesToRemove = [];

        for (let i = 0; i < pageCount; i++) {
            if (await isPageBlank(pdfDoc, i)) {
                pagesToRemove.push(i);
            }
        }

        if (pagesToRemove.length === 0) return pdfBuffer;

        console.log(`[PDF Processor] Removing ${pagesToRemove.length} ghost page(s) at indices: ${pagesToRemove.join(', ')}`);
        
        // Final sanity check: never remove more than 30% of the document
        if (pagesToRemove.length > pageCount * 0.3) {
            console.warn(`[PDF Processor] Detection seems too aggressive (${pagesToRemove.length}/${pageCount}). Aborting cleanup.`);
            return pdfBuffer;
        }

        // Remove pages in reverse order
        for (let i = pagesToRemove.length - 1; i >= 0; i--) {
            pdfDoc.removePage(pagesToRemove[i]);
        }

        return Buffer.from(await pdfDoc.save());
    } catch (e) {
        console.error(`[PDF Processor] Failed to clean PDF: ${e.message}`);
        return pdfBuffer;
    }
}

/**
 * Deep DOCX cleaning to prevent LibreOffice from inserting blank pages.
 */
function cleanDocxXml(xmlContent) {
    let content = xmlContent;
    
    // 1. Remove <w:lastRenderedPageBreak/>
    // Word inserts this to track where it think pages end. LibreOffice often recalculates 
    // based on this and creates duplicates/blank pages.
    content = content.replace(/<w:lastRenderedPageBreak[^>]*\/>/g, '');

    // 2. Normalize Section breaks
    // Force all types to 'nextPage' and remove 'oddPage'/'evenPage' which force blank pages for alignment.
    content = content.replace(/(<w:type\s+w:val=")(?:oddPage|evenPage)(")/g, '$1nextPage$2');

    // 3. Remove structural-only paragraphs that carry section breaks
    // These paragraphs have NO text runs <w:r> but contain a <w:sectPr>.
    // Word hides them; LibreOffice gives them a whole page.
    content = content.replace(/<w:p(?:\s[^>]*)?>(?![^<]*<w:r[\s>])(?:[^<]|<(?!\/w:p>))*?<w:sectPr>[\s\S]*?<\/w:sectPr>(?:[^<]|<(?!\/w:p>))*?<\/w:p>/g, '');

    // 4. Remove empty paragraphs at the end of the body
    content = content.replace(/(<w:p\b[^>]*>)\s*(<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*?<\/w:pPr>)?\s*(<\/w:p>\s*){2,}(<\/w:body>)/g, (match, p1, p2, p3, closing) => {
        return (p2 ? `${p1}${p2}</w:p>` : `${p1}</w:p>`) + closing;
    });

    return content;
}

function preprocessDocxXml(zip) {
    const docFile = zip.file('word/document.xml');
    if (docFile) {
        let content = docFile.asText();
        
        // Senior Fix cleaning
        content = cleanDocxXml(content);

        // Placeholders (user confirmed working)
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // Fonts (user confirmed working)
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        zip.file('word/document.xml', content);
    }

    // Aux files
    const auxFiles = ['word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];
    auxFiles.forEach(filename => {
        const file = zip.file(filename);
        if (!file) return;
        let c = file.asText();
        c = c.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');
        c = c.replace(/Trebuchet MS/g, 'Calibri');
        c = c.replace(/Times New Roman/g, 'Calibri');
        zip.file(filename, c);
    });

    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
        let s = stylesFile.asText().replace(/Trebuchet MS/g, 'Calibri').replace(/Times New Roman/g, 'Calibri');
        zip.file('word/styles.xml', s);
    }
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const username = (req.body.username || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Converting for: ${username}`);

        const zip = new PizZip(req.file.buffer);
        preprocessDocxXml(zip);

        const doc = new Docxtemplater(zip, { linebreaks: true });
        doc.render({
            NOME: username, nome: username.toLowerCase(), NAME: username.toUpperCase(),
            DATA: currentDate, data: currentDate, Data: currentDate, DATE: currentDate, date: currentDate,
        });

        const modifiedDocxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        libre.convert(modifiedDocxBuffer, '.pdf', undefined, async (err, pdfBuffer) => {
            if (err) return res.status(500).json({ error: 'Conversion failed' });

            // Apply Senior PDF cleaning (post-processing)
            const cleanedPdfBuffer = await removeBlankPages(pdfBuffer);
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
            res.send(cleanedPdfBuffer);
        });
    } catch (error) {
        console.error(`[Error] ${error}`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Service port ${PORT}`));
