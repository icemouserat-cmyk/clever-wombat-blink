/**
 * AuraSpace Export Utilities
 * Implemented using native browser APIs to avoid external dependencies.
 */

export const exportToCSV = (filename: string, data: any[], columns: { key: string, label: string }[]) => {
  const header = columns.map(col => `"${col.label}"`).join(',');
  const rows = data.map(item => 
    columns.map(col => {
      const val = item[col.key];
      return `"${val === null || val === undefined ? '' : String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  const csvContent = [header, ...rows].join('\\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
