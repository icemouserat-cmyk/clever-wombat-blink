import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const useQuoteExport = () => {
  const { toast } = useToast();

  const escapeCsv = (val: any) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('\"') || str.includes('\\n')) {
      return `\"${str.replace(/\"/g, '\"\"')}\"`;
    }
    return str;
  };

  const exportCsv = (quotation: any, customer: any, items: any[]) => {
    if (!quotation || !customer) return;

    const headerRows = [
      ['Field', 'Value'],
      ['Quotation ID', quotation.id],
      ['Status', quotation.status],
      ['Customer Name', customer.name],
      ['Referral Source', customer.referral_source],
      ['Staff Size', customer.staff_size],
      ['Created At', quotation.created_at],
      ['Sent At', quotation.sent_at || ''],
      ['Total Amount (RM)', Number(quotation.total_amount).toFixed(2)],
      ['Notes', quotation.notes || ''],
      [],
      ['SKU', 'Quantity', 'Unit Price (RM)', 'Line Total (RM)', 'Item Group', 'Requires A3 Approval', 'Approved'],
    ];

    const itemRows = items.map(item => [
      item.sku,
      item.quantity,
      item.unit_price.toFixed(2),
      item.line_total.toFixed(2),
      item.requires_a3_approval ? 'Furniture - Custom' : 'Furniture - Standard',
      item.requires_a3_approval ? 'Yes' : 'No',
      item.is_approved ? 'Yes' : 'No',
    ]);

    const allRows = [...headerRows, ...itemRows];
    const csvContent = allRows.map(row => row.map(escapeCsv).join(',')).join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeCustomerName = (customer.name || 'quotation').replace(/[^a-z0-9]/gi, '_');
    link.download = `AuraSpace_Quote_${safeCustomerName}_${quotation.id.slice(0, 8)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: 'Quotation CSV downloaded.' });
  };

  const loadImageAsDataUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const exportPdf = async (quotation: any, customer: any, items: any[], logoUrl: string | null) => {
    if (!quotation || !customer) return;

    const doc = new jsPDF();
    let cursorY = 15;

    if (logoUrl) {
      const dataUrl = await loadImageAsDataUrl(logoUrl);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 14, cursorY, 30, 30);
          cursorY += 5;
        } catch {
          // If image embedding fails, continue without it rather than blocking export
        }
      }
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AuraSpace Sdn Bhd', logoUrl ? 50 : 14, cursorY + 8);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Quotation', logoUrl ? 50 : 14, cursorY + 14);

    cursorY += 35;

    doc.setFontSize(11);
    doc.text(`Quotation ID: ${quotation.id.slice(0, 8)}`, 14, cursorY);
    doc.text(`Status: ${quotation.status}`, 140, cursorY);
    cursorY += 6;
    doc.text(`Customer: ${customer.name}`, 14, cursorY);
    doc.text(`Created: ${new Date(quotation.created_at).toLocaleDateString()}`, 140, cursorY);
    cursorY += 6;
    doc.text(`Referral Source: ${customer.referral_source}`, 14, cursorY);
    if (quotation.sent_at) {
      doc.text(`Sent: ${new Date(quotation.sent_at).toLocaleDateString()}`, 140, cursorY);
    }
    cursorY += 6;
    doc.text(`Staff Size: ${customer.staff_size}`, 14, cursorY);
    cursorY += 10;

    if (quotation.notes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const noteLines = doc.splitTextToSize(`Notes: ${quotation.notes}`, 180);
      doc.text(noteLines, 14, cursorY);
      cursorY += noteLines.length * 5 + 5;
      doc.setFont('helvetica', 'normal');
    }

    (doc as any).autoTable({
      startY: cursorY,
      head: [['SKU', 'Qty', 'Unit Price (RM)', 'Line Total (RM)', 'Group', 'A3 Approved']],
      body: items.map(item => [
        item.sku,
        String(item.quantity),
        item.unit_price.toFixed(2),
        item.line_total.toFixed(2),
        item.requires_a3_approval ? 'Custom' : 'Standard',
        item.requires_a3_approval ? (item.is_approved ? 'Yes' : 'No') : 'N/A',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || cursorY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: RM ${Number(quotation.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 140, finalY + 10);

    const safeCustomerName = (customer.name || 'quotation').replace(/[^a-z0-9]/gi, '_');
    doc.save(`AuraSpace_Quote_${safeCustomerName}_${quotation.id.slice(0, 8)}.pdf`);

    toast({ title: 'Exported', description: 'Quotation PDF downloaded.' });
  };

  return { exportCsv, exportPdf };
};
