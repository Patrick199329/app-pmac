const fs = require('fs');
const PizZip = require('pizzip');

const filePath = 'D:\\Priscilla Moreira\\PMACV2\\Relatorio modelo docx\\Relatório Devolutivo PMAC - Realizadores (2).docx';

try {
    const data = fs.readFileSync(filePath);
    const zip = new PizZip(data);
    const docXml = zip.file('word/document.xml').asText();
    
    console.log('--- Document XML Snippet (Sections) ---');
    const sectPrs = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || [];
    sectPrs.forEach((sect, i) => {
        console.log(`Section ${i+1}:`, sect);
    });

    console.log('--- Document XML Snippet (Page Breaks) ---');
    const pageBreaks = docXml.match(/<w:br w:type="page"\/>/g) || [];
    console.log(`Found ${pageBreaks.length} manual page breaks.`);

    // Find the context around page 5-6 (Realizadores section)
    // Looking for "O Perfil Comportamental" and "Os Realizadores"
    const p1 = docXml.indexOf('O Perfil Comportamental');
    const p2 = docXml.indexOf('Os Realizadores');
    
    if (p1 !== -1 && p2 !== -1) {
        console.log('--- Context between Page 5 and 6 ---');
        console.log(docXml.substring(p1 - 50, p2 + 100));
    }

} catch (err) {
    console.error('Error:', err);
}
