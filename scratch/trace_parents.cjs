const fs = require('fs');
const xml = fs.readFileSync('scratch/modal_ui.xml', 'utf8');

// Find all bounds in the xml leading to Suara
// We can use a simple stack of bounds
const lines = xml.split('<node ');
let parents = [];
for (const line of lines) {
    const boundsMatch = line.match(/bounds="(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])"/);
    const textMatch = line.match(/text="([^"]*)"/);
    const bounds = boundsMatch ? boundsMatch[1] : '';
    const text = textMatch ? textMatch[1] : '';
    if (text === 'Suara') {
        console.log('FOUND Suara! Recent bounds:');
        parents.slice(-10).forEach(p => console.log(' ->', p));
        console.log(' -> SUARA:', bounds);
        break;
    }
    parents.push({ bounds, text, snippet: line.substring(0, 60) });
}
