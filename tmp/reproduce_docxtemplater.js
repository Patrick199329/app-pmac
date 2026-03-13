
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const testPlaceholder = (template, data, delimiters) => {
    const zip = new PizZip();
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${template}</w:t></w:r></w:p></w:body></w:document>`);
    
    try {
        const doc = new Docxtemplater(zip, {
            delimiters: delimiters || { start: '{', end: '}' },
            paragraphLoop: true,
            linebreaks: true,
        });
        doc.render(data);
        const xml = doc.getZip().file('word/document.xml').asText();
        console.log(`Template: ${template} | Delimiters: ${JSON.stringify(delimiters || '{ }')} | Result XML: ${xml.includes('undefined') ? 'FAILED (undefined found)' : 'SUCCESS'}`);
        if (xml.includes('undefined')) {
            console.log('XML Content:', xml);
        } else {
            // Find the replaced text
            const match = xml.match(/<w:t>(.*?)<\/w:t>/);
            console.log('Replaced text:', match ? match[1] : 'NOT FOUND');
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
};

const currentDate = new Date().toLocaleDateString('pt-BR');
const data = {
    NOME: 'Test User',
    DATA: currentDate,
    data: currentDate
};

console.log('Running Docxtemplater tests...');
testPlaceholder('{NOME}', data);
testPlaceholder('[NOME]', data, { start: '[', end: ']' });
testPlaceholder('[DATA]', data, { start: '[', end: ']' });
testPlaceholder('[DATA]', { DATA: undefined }, { start: '[', end: ']' });
