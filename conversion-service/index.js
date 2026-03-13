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

        // 2. Pre-process XML: normalize [PLACEHOLDER] -> {PLACEHOLDER} so we only need ONE pass.
        //    This avoids the two-pass approach that causes blank pages in LibreOffice.
        const xmlFiles = [
            'word/document.xml',
            'word/header1.xml',
            'word/header2.xml',
            'word/header3.xml',
            'word/footer1.xml',
            'word/footer2.xml',
            'word/footer3.xml',
        ];

        xmlFiles.forEach(filename => {
            const file = zip.file(filename);
            if (!file) return;
            let content = file.asText();
            // Replace [PLACEHOLDER] with {PLACEHOLDER}, but only outside XML tags
            // The regex matches [WORD] where WORD is alphanumeric/underscore characters
            content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');
            zip.file(filename, content);
        });

        // 3. Single-pass with docxtemplater using standard {PLACEHOLDER} delimiters.
        //    paragraphLoop is intentionally disabled — templates do not use loops,
        //    and enabling it was the primary cause of extra blank pages.
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

        // 4. Get the final modified buffer
        const modifiedDocxBuffer = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        // 5. Convert to PDF
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
