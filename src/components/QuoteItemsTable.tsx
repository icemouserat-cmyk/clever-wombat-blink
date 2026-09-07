import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface QuoteItemsTableProps {
  items: any[];
  onRemoveItem: (id: string) => Promise<void>;
  onToggleApproval: (id: string, currentStatus: boolean) => Promise<void>;
}

const QuoteItemsTable = ({ items, onRemoveItem, onToggleApproval }: QuoteItemsTableProps) => {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left font-medium px-4 py-3">SKU</th>
            <th className="text-left font-medium px-4 py-3">Qty</th>
            <th className="text-left font-medium px-4 py-3">Unit Price</th>
            <th className="text-left font-medium px-4 py-3">Total</th>
            <th className="text-left font-medium px-4 py-3">Approval</th>
            <th className="text-right font-medium px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-muted-foreground">
                No items added to this quotation yet.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono font-medium">{item.sku}</td>
                <td className="px-4 py-2">{item.quantity}</td>
                <td className="px-4 py-2">RM {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 font-medium">RM {item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-2">
                  {item.requires_a3_approval ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleApproval(item.id, item.is_approved)}
                      className="h-7 px-2"
                    >
                      {item.is_approved ? (
                        <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500 hover:bg-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Pending A3
                        </Badge>
                      )}
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="font-normal">Standard</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onRemoveItem(item.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default QuoteItemsTable;
