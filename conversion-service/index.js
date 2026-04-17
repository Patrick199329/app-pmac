const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const app = express();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const INTERNAL_TOKEN = process.env.INTERNAL_CONVERTER_TOKEN;

app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!INTERNAL_TOKEN || authHeader !== `Bearer ${INTERNAL_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
});

/**
 * Substitui placeholders [TAG] em arquivos ODT via regex
 * (docxtemplater não suporta ODT)
 */
function replaceOdtPlaceholders(zip, data) {
    const files = ['content.xml', 'styles.xml'];
    files.forEach(filename => {
        const file = zip.file(filename);
        if (!file) return;

        let content = file.asText();

        // Repara fragmentação XML dentro de colchetes: [N<tag>OME</tag>] -> [NOME]
        content = content.replace(/\[([^\]]+)\]/g, (match, inner) => {
            const cleaned = inner.replace(/<[^>]+>/g, '').trim();
            return cleaned ? `[${cleaned}]` : match;
        });

        // Substitui as tags conhecidas (mais longo primeiro para evitar match parcial)
        const sortedKeys = Object.keys(data).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(key => {
            const escaped = String(data[key])
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            content = content.replace(new RegExp(`\\[${key}\\]`, 'gi'), escaped);
        });

        zip.file(filename, content);
    });
}

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const fullName    = (req.body.fullName    || 'Usuário').trim();
        const firstName   = (req.body.firstName   || fullName.split(' ')[0] || 'Usuário').trim();
        const currentDate = (req.body.currentDate || new Date().toLocaleDateString('pt-BR')).trim();

        console.log(`[CONVERT] fullName="${fullName}", firstName="${firstName}", data="${currentDate}"`);

        const zip   = new PizZip(req.file.buffer);
        const isOdt = !!zip.file('content.xml');

        const data = {
            NOME_COMPLETO: fullName,
            NOME:          firstName,
            DATA:          currentDate
        };

        let modifiedBuffer;

        if (isOdt) {
            // ODT: substituição via regex
            replaceOdtPlaceholders(zip, data);
            modifiedBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        } else {
            // DOCX: Limpeza de fragmentação em TODOS os arquivos XML (Corpo, Cabeçalhos, Rodapés)
            const xmlFiles = zip.file(/\.xml$/);
            xmlFiles.forEach(file => {
                const fileName = file.name;
                // Processamos apenas arquivos estruturais do Word
                if (fileName.startsWith('word/')) {
                    let xmlContent = file.asText();
                    const originalContent = xmlContent;
                    
                    // Regex robusto: busca [ tags ] mesmo que o Word as quebre em múltiplos <w:t>
                    // Ex: [NOME</w:t></w:r><w:r><w:t>_COMPLETO] -> [NOME_COMPLETO]
                    xmlContent = xmlContent.replace(/\[([^\]]+)\]/g, (match, inner) => {
                        if (!inner.includes('<')) return match; // Já está limpo
                        
                        const cleaned = inner.replace(/<[^>]+>/g, '').trim();
                        // Se sobrou algo após remover tags, unificamos
                        if (cleaned) {
                            console.log(`[DEFRAG] "${match.substring(0, 20)}..." -> "[${cleaned}]" em ${fileName}`);
                            return `[${cleaned}]`;
                        }
                        return match;
                    });

                    if (xmlContent !== originalContent) {
                        zip.file(fileName, xmlContent);
                    }
                }
            });

            // DOCX: docxtemplater com delimitadores [TAG]
            const doc = new Docxtemplater(zip, {
                delimiters: { start: '[', end: ']' },
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: (part) => `[${part.value}]`
            });

            doc.render(data);

            modifiedBuffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE'
            });
        }

        libre.convert(modifiedBuffer, '.pdf', undefined, (err, pdfBuffer) => {
            if (err) {
                console.error('[CONVERT] LibreOffice error:', err);
                return res.status(500).json({ error: 'Conversion failed', details: err.message });
            }
            console.log('[CONVERT] PDF gerado com sucesso.');
            res.setHeader('Content-Type', 'application/pdf');
            res.send(pdfBuffer);
        });

    } catch (error) {
        console.error('[CONVERT] Error:', error.message);
        res.status(500).json({ error: 'Processing failed', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Conversion service on port ${PORT}`));
