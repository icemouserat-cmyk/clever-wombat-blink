import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, Truck, Trash2 } from 'lucide-react';

const itemSchema = z.object({
  sku: z.string().min(1, { message: "SKU is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  base_cost: z.coerce.number().min(0, { message: "Base cost must be non-negative" }),
  item_group: z.enum(['Standard', 'Custom']),
  supplier_id: z.string().min(1, { message: "Supplier is required" }),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function PricingPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      sku: '',
      description: '',
      base_cost: 0,
      item_group: 'Standard',
      supplier_id: '',
    },
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, suppliersRes] = await Promise.all([
        supabase.from('price_list').select('*, suppliers(name)').order('sku'),
        supabase.from('suppliers').select('*').order('name'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setItems(itemsRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function onSubmitItem(values: ItemFormValues) {
    try {
      const { error } = await supabase.from('price_list').upsert(values, { onConflict: 'sku' });
      if (error) throw error;

      toast({
        title: "Price List Updated",
        description: "Item has been successfully saved.",
      });
      form.reset();
      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving item",
        description: error.message,
      });
    }
  }

  async function handleAddSupplier() {
    if (!newSupplierName) return;
    try {
      const { error } = await supabase.from('suppliers').insert([{ name: newSupplierName }]);
      if (error) throw error;

      toast({
        title: "Supplier Added",
        description: `Supplier ${newSupplierName} has been added.`,
      });
      setNewSupplierName('');
      setIsSupplierDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding supplier",
        description: error.message,
      });
    }
  }

  async function handleDeleteItem(id: string) {
    try {
      const { error } = await supabase.from('price_list').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Item Removed", description: "Item has been deleted from the price list." });
      await fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error removing item",
        description: error.message,
      });
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900">Master Price List</h1>
          <p className="text-slate-500">Centralized cost management for all furniture items.</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Truck className="w-4 h-4" /> Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>Enter the supplier name to add them to the reference list.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <Input 
                  placeholder="Supplier Name (e.g. Artmatrix)" 
                  value={newSupplierName} 
                  onChange={(e) => setNewSupplierName(e.target.value)} 
                />
                <Button 
                  onClick={handleAddSupplier} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={!newSupplierName}
                >
                  Save Supplier
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitItem)} className="space-y-6 bg-white p-6 rounded-xl border shadow-sm">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                  <Package className="w-5 h-5" /> Add/Edit Item
                </h3>
                <p className="text-sm text-slate-500">Add a new SKU or update an existing cost.</p>
              </div>

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="FUR-CHAIR-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Ergonomic Office Chair" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="base_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Cost ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="120.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="item_group"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Group</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                Save to Price List
              </Button>
            </form>
          </Form>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                      Loading price list...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                      No items found. Start by adding one on the left.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{item.sku}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>
                        <Badge variant={item.item_group === 'Custom' ? 'destructive' : 'secondary'}>
                          {item.item_group}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.suppliers?.name || 'N/A'}</TableCell>
                      <TableCell className="font-medium">${item.base_cost}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
