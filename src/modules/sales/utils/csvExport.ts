export interface CSVColumn {
  key: string;
  header: string;
  formatter?: (value: any, row: any) => string;
}

export function exportToCSV(data: any[], columns: CSVColumn[], filename: string) {
  if (!data.length) return;

  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = row[col.key];
      const formatted = col.formatter ? col.formatter(value, row) : String(value ?? '');
      // Escape quotes and wrap in quotes if contains comma/newline/quote
      if (formatted.includes(',') || formatted.includes('\n') || formatted.includes('"')) {
        return `"${formatted.replace(/"/g, '""')}"`;
      }
      return formatted;
    })
  );

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
