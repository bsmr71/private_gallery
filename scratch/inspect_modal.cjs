const fs = require('fs');
const xml = fs.readFileSync('scratch/modal_ui.xml', 'utf8');

// Find where "Suara" is
const suaraIdx = xml.indexOf('text="Suara"');
if (suaraIdx !== -1) {
    // print 2000 chars around Suara
    console.log(xml.substring(Math.max(0, suaraIdx - 1500), Math.min(xml.length, suaraIdx + 1500)));
} else {
    console.log('Suara not found');
}
