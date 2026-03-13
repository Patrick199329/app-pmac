const fs = require('fs');
const PizZip = require('pizzip');

const nodeModulesPath = "D:\\Priscilla Moreira\\PMACV2\\conversion-service\\node_modules";
module.paths.push(nodeModulesPath);

const filePath = "D:\\Priscilla Moreira\\PMACV2\\Relatorio modelo docx\\PMAC Básica - Realizadores (2).docx";

try {
    const data = fs.readFileSync(filePath);
    const zip = new PizZip(data);
    const docXml = zip.file('word/document.xml').asText();
    
    const sectRegex = /<w:sectPr[\s\S]*?<\/w:sectPr>/g;
    let match;
    let count = 0;
    while ((match = sectRegex.exec(docXml)) !== null) {
        count++;
        console.log(`--- Section ${count} at ${match.index} ---`);
        const content = match[0];
        console.log(content);
        
        const typeMatch = content.match(/<w:type\s+w:val="([^"]+)"\/>/);
        if (typeMatch) {
            console.log(`TYPE: ${typeMatch[1]}`);
        } else {
            console.log('TYPE: (none, default is next page)');
        }
    }

} catch (err) {
    console.error('Error:', err);
}
