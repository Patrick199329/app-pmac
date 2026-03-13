const fs = require('fs');
const PizZip = require('pizzip');

const filePath = "D:\\Priscilla Moreira\\PMACV2\\Relatorio modelo docx\\PMAC Básica - Realizadores (2).docx";

try {
    const data = fs.readFileSync(filePath);
    const zip = new PizZip(data);
    const docXml = zip.file('word/document.xml').asText();
    
    const offset = 94257;
    console.log('--- XML RANGE [94000, 95000] ---');
    console.log(docXml.substring(94000, 95000));

} catch (err) {
    console.error('Error:', err);
}
