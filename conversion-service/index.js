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
 * Universal XML patching for DOCX and ODT.
 */
function patchXml(zip) {
    const isOdt = !!zip.file('content.xml');
    
    const filesToPatch = isOdt 
        ? ['content.xml', 'styles.xml'] 
        : [
            'word/document.xml', 'word/styles.xml', 
            'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 
            'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'
          ];

    filesToPatch.forEach(filename => {
        const file = zip.file(filename);
        if (!file) return;
        
        let content = file.asText();

        // 1. Normalize placeholders [TAG] -> {TAG}
        content = content.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '{$1}');

        // 2. Font replacement (Targets fallback Carlito/Caladea on Linux)
        content = content.replace(/Trebuchet MS/g, 'Calibri');
        content = content.replace(/Times New Roman/g, 'Calibri');

        // 3. Structural Fixes
        if (filename === 'word/document.xml') {
            // DOCX Blank Page fix: change page break type to avoid extra empty pages
            content = content.replace(/(<w:type\s+w:val=")(?:oddPage|evenPage)(")/g, '$1nextPage$2');
        }

        zip.file(filename, content);
    });

    return isOdt;
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const username = (req.body.username || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Converting for: ${username} (Format: ${req.file.originalname})`);

        const zip = new PizZip(req.file.buffer);
        
        // Detect and patch
        const isOdt = patchXml(zip);

        const data = {
            NOME: username, nome: username.toLowerCase(), NAME: username.toUpperCase(),
            DATA: currentDate, data: currentDate, Data: currentDate, DATE: currentDate, date: currentDate,
        };

        let modifiedBuffer;
        if (isOdt) {
            console.log("DEBUG: ODT Replacement Logic (Manual XML Safe)");
            const xmlFiles = ['content.xml', 'styles.xml'];
            xmlFiles.forEach(xmlPath => {
                const file = zip.file(xmlPath);
                if (!file) return;
                
                let content = file.asText();
                for (const [key, value] of Object.entries(data)) {
                    const escapedValue = String(value)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    const regex = new RegExp(`\\{${key}\\}`, 'g');
                    content = content.replace(regex, escapedValue);
                }
                zip.file(xmlPath, content);
            });
            modifiedBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        } else {
            // Standard DOCX replacement
            const doc = new Docxtemplater(zip, { linebreaks: true });
            doc.render(data);
            modifiedBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        }

        // Conversion to PDF
        libre.convert(modifiedBuffer, '.pdf', undefined, (err, pdfBuffer) => {
            if (err) {
                console.error("Conversion Error:", err);
                return res.status(500).json({ error: 'Conversion failed' });
            }
            
            res.setHeader('Content-Type', 'application/pdf');
            res.send(pdfBuffer);
        });
    } catch (error) {
        console.error(`[Error] ${error}`);
        res.status(500).json({ error: 'Processing failed', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Service port ${PORT}`));

