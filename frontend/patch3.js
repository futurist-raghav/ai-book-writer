const fs = require('fs');
const code = fs.readFileSync('src/components/writer-canvas-tiptap.tsx', 'utf-8');
const newCode = code.replace(
  "return () => editor.off('update', handleUpdate);",
  "return () => { editor.off('update', handleUpdate); };"
).replace(
  "const issues = [];",
  "const issues: any[] = [];"
);
fs.writeFileSync('src/components/writer-canvas-tiptap.tsx', newCode);
