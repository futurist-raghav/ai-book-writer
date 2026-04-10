import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Flow Timeline Exporter
 * Handles exporting flow events in multiple formats
 */

export class FlowTimelineExporter {
  /**
   * Export timeline as PNG image
   */
  static async exportAsImage(
    chartElement: HTMLElement,
    filename: string = 'flow-timeline.png'
  ): Promise<void> {
    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
    } catch (error) {
      console.error('Failed to export as PNG:', error);
      throw error;
    }
  }

  /**
   * Export timeline as PDF
   */
  static async exportAsPDF(
    chartElement: HTMLElement,
    projectTitle: string,
    filename: string = 'flow-timeline.pdf'
  ): Promise<void> {
    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.setFont('Helvetica', 'B');
      pdf.text(projectTitle, 10, 10);
      pdf.setFont('Helvetica', 'N');
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 16);

      pdf.addImage(imgData, 'PNG', 10, 20, imgWidth - 20, imgHeight - 10);
      pdf.save(filename);
    } catch (error) {
      console.error('Failed to export as PDF:', error);
      throw error;
    }
  }

  /**
   * Export events as CSV
   */
  static async exportAsCSV<T extends Record<string, any>>(
    events: T[],
    filename: string = 'flow-events.csv'
  ): Promise<void> {
    try {
      if (events.length === 0) {
        throw new Error('No events to export');
      }

      // Get headers from first event
      const headers = Object.keys(events[0]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...events.map((event) =>
          headers
            .map((header) => {
              const value = event[header];
              // Escape quotes and wrap in quotes if needed
              if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? '';
            })
            .join(',')
        ),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      // Clean up
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Failed to export as CSV:', error);
      throw error;
    }
  }

  /**
   * Export as JSON (for archival or data sync)
   */
  static async exportAsJSON<T extends Record<string, any>>(
    data: T,
    filename: string = 'flow-data.json'
  ): Promise<void> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();

      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Failed to export as JSON:', error);
      throw error;
    }
  }
}
