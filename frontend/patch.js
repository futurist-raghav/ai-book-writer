const fs = require('fs');
const code = fs.readFileSync('src/components/writer-canvas-tiptap.tsx', 'utf-8');
const lines = code.split('\n');
lines.splice(780, 0, '        )}');
fs.writeFileSync('src/components/writer-canvas-tiptap.tsx', lines.join('\n'));
