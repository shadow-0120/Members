import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Export to PDF
export const exportToPDF = (data, columns, filename) => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const rowHeight = 10;
  const maxWidth = doc.internal.pageSize.width - 2 * margin;

  // Title
  doc.setFontSize(16);
  doc.text(filename, margin, yPos);
  yPos += 10;

  // Headers
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  const headerWidth = maxWidth / columns.length;
  columns.forEach((col, index) => {
    doc.text(col.header, margin + index * headerWidth, yPos);
  });
  yPos += rowHeight;

  // Data rows
  doc.setFont(undefined, 'normal');
  data.forEach((row) => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    columns.forEach((col, index) => {
      const value = col.accessor ? col.accessor(row) : row[col.key] || '';
      const text = String(value).substring(0, 20); // Limit text length
      doc.text(text, margin + index * headerWidth, yPos);
    });
    yPos += rowHeight;
  });

  doc.save(`${filename}.pdf`);
};

// Export to Excel
export const exportToExcel = (data, columns, filename) => {
  const worksheetData = [
    columns.map(col => col.header),
    ...data.map(row => columns.map(col => col.accessor ? col.accessor(row) : row[col.key] || ''))
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Auto-size columns
  const maxWidth = 50;
  const colWidths = columns.map((_, colIndex) => {
    const maxLength = Math.max(
      ...worksheetData.map(row => String(row[colIndex] || '').length)
    );
    return { wch: Math.min(maxLength + 2, maxWidth) };
  });
  worksheet['!cols'] = colWidths;

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

// Export to JSON
export const exportToJSON = (data, filename) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
};

// Import from JSON
export const importFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        resolve(jsonData);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
};

