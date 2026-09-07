import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface QuoteItemManagerProps {
  priceList: any[];
  onAddItem: (sku: string, quantity: number) => Promise<void>;
}

const QuoteItemManager = ({ priceList, onAddItem }: QuoteItemManagerProps) => {
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);

  const handleAdd = async () => {
    if (!selectedSku) return;
    await onAddItem(selectedSku, quantity);
    setSelectedSku('');
    setQuantity(1);
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Plus className="h-5 w-5" /> Add Line Item
      </h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Select Item (SKU)</Label>
          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger><SelectValue placeholder="Choose a product..." /></SelectTrigger>
            <SelectContent>
              {priceList.map(p => (
                <SelectItem key={p.id} value={p.sku}>
                  {p.sku} - {p.description} (RM {p.base_cost})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
        </div>
        <Button className="w-full" onClick={handleAdd} disabled={!selectedSku}>
          Add to Quotation
        </Button>
      </div>
    </div>
  );
};

export default QuoteItemManager;
