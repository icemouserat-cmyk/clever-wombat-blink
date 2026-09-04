import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Package, DollarSign, FileText } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">AuraSpace Console</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-muted-foreground">Manage inquiries, quotations, and your catalogue from here.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/inquiries" className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Inquiries</h3>
              <p className="text-sm text-muted-foreground">Capture new leads</p>
            </div>
          </Link>

          <Link to="/quotations" className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Quotations</h3>
              <p className="text-sm text-muted-foreground">Build and send quotes</p>
            </div>
          </Link>

          <Link to="/settings/pricing" className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Price List</h3>
              <p className="text-sm text-muted-foreground">Manage SKUs and pricing</p>
            </div>
          </Link>

          <Link to="/settings/suppliers" className="rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Suppliers</h3>
              <p className="text-sm text-muted-foreground">Factory partner references</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
