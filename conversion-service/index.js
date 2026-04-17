const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const app = express();
const upload = multer({
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
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

            // 4. Force A4 Page Size (210mm x 297mm) - Twips: w=11906, h=16838
            // This ensures results are A4 even if template is Letter or custom
            content = content.replace(/<w:pgSz[^>]*\/>/g, '<w:pgSz w:w="11906" w:h="16838"/>');
        }

        // 5. ODT A4 Enforcement (Common in styles.xml or content.xml)
        if (isOdt) {
            content = content.replace(/fo:page-width="[^"]*"/g, 'fo:page-width="21.0cm"');
            content = content.replace(/fo:page-height="[^"]*"/g, 'fo:page-height="29.7cm"');
        }

        zip.file(filename, content);
    });

    return isOdt;
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const fullName = (req.body.fullName || req.body.username || 'Usuário').trim();
        const firstName = (req.body.firstName || fullName.split(' ')[0] || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[${new Date().toISOString()}] Converting for: ${fullName} (FirstName: ${firstName})`);

        const zip = new PizZip(req.file.buffer);
        
        // 1. Universal Patching (also detects format)
        const isOdt = patchXml(zip);

        const data = {
            // Nome Curto
            NOME: firstName, nome: firstName.toLowerCase(), Nome: firstName, NAME: firstName.toUpperCase(),
            // Nome Completo
            NOME_COMPLETO: fullName, nome_completo: fullName.toLowerCase(), Nome_Completo: fullName, NAME_FULL: fullName.toUpperCase(),
            // Datas
            DATA: currentDate, data: currentDate, Data: currentDate, DATE: currentDate, date: currentDate,
        };

        console.log(`[DEBUG] Processor: Universal Manual XML (isOdt: ${isOdt})`);

        // 2. Universal Manual Replacement
        const filesToProcess = isOdt 
            ? ['content.xml', 'styles.xml'] 
            : [
                'word/document.xml', 'word/styles.xml', 
                'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 
                'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'
              ];

        filesToProcess.forEach(xmlPath => {
            const file = zip.file(xmlPath);
            if (!file) return;
            
            let content = file.asText();
            for (const [key, value] of Object.entries(data)) {
                // Support both {TAG} and [TAG] (patchXml usually converts [ to {)
                const escapedValue = String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                
                // Replace {KEY} or [KEY]
                content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), escapedValue);
                content = content.replace(new RegExp(`\\[${key}\\]`, 'g'), escapedValue);
            }
            zip.file(xmlPath, content);
        });

        const modifiedBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        // 3. Conversion to PDF
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

