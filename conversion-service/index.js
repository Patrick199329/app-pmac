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
    if (!INTERNAL_TOKEN || authHeader !== `Bearer ${INTERNAL_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

/**
 * Non-destructive XML patching.
 * We ONLY replace strings; we never delete elements or structural tags.
 */
function patchDocxXml(zip) {
    const docFile = zip.file('word/document.xml');
    if (docFile) {
        let content = docFile.asText();

        // 1. Normalize placeholders (user confirmed working)
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // 2. Font replacement (user confirmed working)
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        // 3. TARGETED BLANK PAGE FIX:
        // LibreOffice inserts blank pages when it sees 'oddPage' or 'evenPage' section breaks.
        // We change these to 'nextPage' WITHOUT deleting the paragraph.
        // This preserves headers, footers, and background anchors.
        content = content.replace(/(<w:type\s+w:val=")(?:oddPage|evenPage)(")/g, '$1nextPage$2');

        zip.file('word/document.xml', content);
    }

    // Aux files (headers/footers)
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
        let s = stylesFile.asText()
            .replace(/Trebuchet MS/g, 'Calibri')
            .replace(/Times New Roman/g, 'Calibri');
        zip.file('word/styles.xml', s);
    }
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const username = (req.body.username || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Converting (Safe Mode) for: ${username}`);

        const zip = new PizZip(req.file.buffer);
        
        // Use non-destructive patching
        patchDocxXml(zip);

        const doc = new Docxtemplater(zip, { linebreaks: true });
        doc.render({
            NOME: username, nome: username.toLowerCase(), NAME: username.toUpperCase(),
            DATA: currentDate, data: currentDate, Data: currentDate, DATE: currentDate, date: currentDate,
        });

        const modifiedDocxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        // NO POST-PROCESSING on PDF. We trust LibreOffice with the patched XML.
        libre.convert(modifiedDocxBuffer, '.pdf', undefined, (err, pdfBuffer) => {
            if (err) return res.status(500).json({ error: 'Conversion failed' });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
            res.send(pdfBuffer);
        });
    } catch (error) {
        console.error(`[Error] ${error}`);
        res.status(500).json({ error: 'Processing failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Service port ${PORT}`));
