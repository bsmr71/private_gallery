const fs = require('fs');
const xml = fs.readFileSync('scratch/modal_ui.xml', 'utf8');

// Parse all nodes and print indentation
const lines = xml.split('><');
for (const line of lines) {
    const classM = line.match(/class="([^"]*)"/);
    const boundsM = line.match(/bounds="([^"]*)"/);
    const textM = line.match(/text="([^"]*)"/);
    const descM = line.match(/content-desc="([^"]*)"/);
    const cls = classM ? classM[1].split('.').pop() : '';
    const bounds = boundsM ? boundsM[1] : '';
    const text = textM && textM[1] ? ` text="${textM[1]}"` : '';
    const desc = descM && descM[1] ? ` desc="${descM[1]}"` : '';
    if (bounds) {
        console.log(`${bounds} | ${cls}${text}${desc}`);
    }
}
