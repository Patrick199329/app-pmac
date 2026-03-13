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
        const docxBuffer = req.file.buffer;

        // 1. Load the docx file as zip
        const zip = new PizZip(docxBuffer);

        // 2. Initialize docxtemplater with custom delimiters to support [NOME] and {NOME}
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // 3. Replace placeholders
        const data = {
            NOME: username,
            nome: username.toLowerCase(),
            NAME: username.toUpperCase(),
            DATA: new Date().toLocaleDateString('pt-BR'),
            data: new Date().toLocaleDateString('pt-BR')
        };

        doc.render(data);

        // 4. Get the intermediate buffer
        const intermediateBuffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        // 5. Second pass for [ ] delimiters
        const zip2 = new PizZip(intermediateBuffer);
        const doc2 = new Docxtemplater(zip2, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '[', end: ']' }
        });
        doc2.render(data);

        // 6. Get the final modified buffer
        const modifiedDocxBuffer = doc2.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        // 7. Convert to PDF
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
