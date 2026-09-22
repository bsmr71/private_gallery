const fs = require('fs');
const xml = fs.readFileSync('scratch/ui.xml', 'utf8');

const regex = /<node[^>]*text="([^"]*)"[^>]*content-desc="([^"]*)"[^>]*bounds="([^"]*)"/g;
let m;
while ((m = regex.exec(xml)) !== null) {
    if (m[1] || m[2]) {
        console.log(`text="${m[1]}" desc="${m[2]}" bounds="${m[3]}"`);
    }
}
