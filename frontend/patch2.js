const fs = require('fs');
const code = fs.readFileSync('src/components/writer-canvas-tiptap.tsx', 'utf-8');
const lines = code.split('\n');

const detectIndex = lines.findIndex(l => l.includes('const detectChanges = useCallback((newContent: string) => {'));
const toggleTrackIndex = lines.findIndex(l => l.includes('const toggleTrackingChanges = useCallback('));

const blockEnd = lines.findIndex((l, i) => i > detectIndex && l.includes('  }, [isTrackingChanges]);')) + 1;

const block = lines.splice(detectIndex - 1, blockEnd - detectIndex + 1);

const insertIndex = lines.findIndex(l => l.includes('// Track changes when enabled'));
lines.splice(insertIndex, 0, ...block);
fs.writeFileSync('src/components/writer-canvas-tiptap.tsx', lines.join('\n'));

