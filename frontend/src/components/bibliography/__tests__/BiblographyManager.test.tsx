import { BibliographyManager } from '@/components/bibliography-manager';
import { Citation } from '@/components/bibliography/CitationTool';

describe('Bibliography module smoke tests', () => {
  it('exports bibliography manager component', () => {
    expect(typeof BibliographyManager).toBe('function');
  });

  it('exports citation extension', () => {
    expect(Citation).toBeTruthy();
  });
});
