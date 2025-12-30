"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { VendorTable } from '@/components/vendors/VendorTable';
import { VendorDetailDialog } from '@/components/vendors/VendorDetailDialog';
import { CreateVendorDialog } from '@/components/vendors/CreateVendorDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Vendor {
  id: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  createdAt: string;
  _count: {
    templates: number;
    invoices: number;
  };
}

export default function VendorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch vendors
  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vendors');
      const data = await response.json();

      if (data.success) {
        setVendors(data.vendors);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchVendors();
    }
  }, [status]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-4xl font-bold">Vendor Management</h1>
            </div>
            <p className="text-muted-foreground">
              Manage vendors and customize invoice extraction templates
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        {/* Vendors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Vendors</CardTitle>
            <CardDescription>
              Create vendor profiles with custom extraction rules for accurate invoice processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorTable
              vendors={vendors}
              loading={loading}
              onVendorClick={setSelectedVendor}
              onRefresh={fetchVendors}
            />
          </CardContent>
        </Card>

        {/* Dialogs */}
        <CreateVendorDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            fetchVendors();
            setCreateDialogOpen(false);
          }}
        />

        <VendorDetailDialog
          vendor={selectedVendor}
          open={!!selectedVendor}
          onOpenChange={(open) => !open && setSelectedVendor(null)}
          onRefresh={fetchVendors}
        />
      </div>
    </div>
  );
}
