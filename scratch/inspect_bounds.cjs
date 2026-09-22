const fs = require('fs');
const xml = fs.readFileSync('scratch/ui.xml', 'utf8');

const regex = /<node[^>]*bounds="\[0,443\]\[357,801\]"[^>]*>/g;
let m;
while ((m = regex.exec(xml)) !== null) {
    console.log(m[0]);
}

// Also check children inside that range
const allRegex = /<node[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/g;
while ((m = allRegex.exec(xml)) !== null) {
    const [_, x1, y1, x2, y2] = m;
    if (parseInt(x1) >= 0 && parseInt(x2) <= 357 && parseInt(y1) >= 440 && parseInt(y2) <= 805) {
        console.log(`Child: ${m[0]}`);
    }
}
