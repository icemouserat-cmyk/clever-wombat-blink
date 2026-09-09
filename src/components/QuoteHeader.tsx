import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileDown, Send, CheckCircle, FileText } from 'lucide-react';
import { getQuotationStatusLabel } from '@/lib/statusLabels';

interface QuoteHeaderProps {
  quotation: any;
  customer: any;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onMarkAsSent: () => void;
  onMarkAsOrder: () => void;
  onGenerateInvoice: () => void;
  invoice: any;
}

const QuoteHeader = ({ quotation, customer, onExportCsv, onExportPdf, onMarkAsSent, onMarkAsOrder, onGenerateInvoice, invoice }: QuoteHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-start">
      <div className="space-y-1">
        <Button
          variant="ghost"
          onClick={() => navigate(quotation?.status === 'Order' ? '/progress' : '/quotations')}
          className="mb-4 -ml-4 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {quotation?.status === 'Order' ? 'Back to Progress' : 'Back to Quotations'}
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{quotation?.status === 'Order' ? 'Order Details' : 'Quotation Builder'}</h1>
          <Badge variant="outline" className="text-sm">{getQuotationStatusLabel(quotation?.status)}</Badge>
          {quotation?.workflow_state && (
            <Badge variant="outline" className="text-sm border-blue-500 text-blue-700">
              {quotation.workflow_state}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Customer: <span className="font-medium text-foreground">{customer?.name}</span> |
          Staff Size: <span className="font-medium text-foreground">{customer?.staff_size}</span>
        </p>
        {(quotation?.erpnext_quotation_id || quotation?.erpnext_sales_order_id) && (
          <p className="text-xs text-muted-foreground font-mono">
            {quotation?.erpnext_quotation_id && <>ERPNext Quotation: {quotation.erpnext_quotation_id}</>}
            {quotation?.erpnext_quotation_id && quotation?.erpnext_sales_order_id && ' · '}
            {quotation?.erpnext_sales_order_id && <>ERPNext Sales Order: {quotation.erpnext_sales_order_id}</>}
          </p>
        )}
        {customer?.address && (
          <span className="block text-sm mt-1">
            Address: <span className="font-medium text-foreground">{customer.address}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right space-y-1">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-4xl font-bold text-primary">
            RM {quotation?.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onExportCsv} disabled={!quotation} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPdf} disabled={!quotation} className="flex items-center gap-2">
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
          {quotation?.status === 'Draft' && (
            <Button onClick={onMarkAsSent} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Send className="h-4 w-4" /> Mark as Sent
            </Button>
          )}
          {quotation?.status === 'Sent' && (
            <Button onClick={onMarkAsOrder} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="h-4 w-4" /> Mark as Order
            </Button>
          )}
          {quotation?.status === 'Order' && !invoice && (
            <Button onClick={onGenerateInvoice} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <FileText className="h-4 w-4" /> Generate Invoice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuoteHeader;
