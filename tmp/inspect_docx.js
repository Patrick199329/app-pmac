const fs = require('fs');
const PizZip = require('pizzip');

const filePath = "d:/Priscilla Moreira/PMACV2/tmp/test_template.docx";

try {
    const data = fs.readFileSync(filePath);
    const zip = new PizZip(data);
    const docXml = zip.file('word/document.xml').asText();
    
    // Procura pela tag de tamanho de página
    const pgSzMatch = docXml.match(/<w:pgSz[^>]*\/>/);
    console.log('--- Página Localizada ---');
    console.log(pgSzMatch ? pgSzMatch[0] : 'Tag <w:pgSz> não encontrada!');

} catch (err) {
    console.error('Error:', err);
}
