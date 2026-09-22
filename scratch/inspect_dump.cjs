const fs = require('fs');
const xml = fs.readFileSync('mobile-app/scratch/dump.xml', 'utf8');
const regex = /<node\s+([^>]+)>/g;
let match;
while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1];
    const bounds = (attrs.match(/bounds="([^"]+)"/) || [])[1] || '';
    const text = (attrs.match(/text="([^"]+)"/) || [])[1] || '';
    const desc = (attrs.match(/content-desc="([^"]+)"/) || [])[1] || '';
    const cls = (attrs.match(/class="([^"]+)"/) || [])[1] || '';
    console.log(`${bounds} | ${cls.split('.').pop()}${text ? ' text=' + text : ''}${desc ? ' desc=' + desc : ''}`);
}
