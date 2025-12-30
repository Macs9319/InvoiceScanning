"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, FileText, List } from 'lucide-react';
import { TemplateEditor } from './TemplateEditor';

interface Vendor {
  id: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  identifiers?: string;
  _count?: {
    templates: number;
    invoices: number;
  };
}

interface Template {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  invoiceCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

interface VendorDetailDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function VendorDetailDialog({ vendor, open, onOpenChange, onRefresh }: VendorDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [vendorDetails, setVendorDetails] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (vendor && open) {
      fetchVendorDetails();
      fetchTemplates();
    }
  }, [vendor, open]);

  const fetchVendorDetails = async () => {
    if (!vendor) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/vendors/${vendor.id}`);
      const data = await response.json();

      if (data.success) {
        setVendorDetails(data.vendor);
      }
    } catch (error) {
      console.error('Error fetching vendor details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!vendor) return;

    try {
      const response = await fetch(`/api/vendors/${vendor.id}/templates`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setTemplateEditorOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setTemplateEditorOpen(true);
  };

  const handleTemplateSuccess = () => {
    fetchTemplates();
    setTemplateEditorOpen(false);
    setSelectedTemplate(null);
  };

  if (!vendor) return null;

  const identifiers = vendorDetails?.identifiers
    ? JSON.parse(vendorDetails.identifiers)
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{vendor.name}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">
                <FileText className="h-4 w-4 mr-2" />
                Info
              </TabsTrigger>
              <TabsTrigger value="templates">
                <List className="h-4 w-4 mr-2" />
                Templates ({templates.length})
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices ({vendor._count?.invoices || 0})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px] mt-4">
              <TabsContent value="info" className="space-y-6">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Vendor Name
                        </label>
                        <p className="text-sm mt-1">{vendorDetails?.name}</p>
                      </div>

                      {vendorDetails?.email && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Email
                          </label>
                          <p className="text-sm mt-1">{vendorDetails.email}</p>
                        </div>
                      )}

                      {vendorDetails?.phone && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Phone
                          </label>
                          <p className="text-sm mt-1">{vendorDetails.phone}</p>
                        </div>
                      )}

                      {vendorDetails?.website && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Website
                          </label>
                          <p className="text-sm mt-1">
                            <a
                              href={vendorDetails.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {vendorDetails.website}
                            </a>
                          </p>
                        </div>
                      )}
                    </div>

                    {vendorDetails?.description && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Description
                        </label>
                        <p className="text-sm mt-1">{vendorDetails.description}</p>
                      </div>
                    )}

                    {vendorDetails?.address && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Address
                        </label>
                        <p className="text-sm mt-1 whitespace-pre-line">
                          {vendorDetails.address}
                        </p>
                      </div>
                    )}

                    {identifiers.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Detection Identifiers
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {identifiers.map((id: string, index: number) => (
                            <Badge key={index} variant="secondary">
                              {id}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          These identifiers help auto-detect this vendor from invoice text
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Templates
                        </label>
                        <p className="text-2xl font-bold mt-1">
                          {vendor._count?.templates || 0}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Linked Invoices
                        </label>
                        <p className="text-2xl font-bold mt-1">
                          {vendor._count?.invoices || 0}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {templates.length === 0
                      ? 'No templates yet. Create one to customize extraction.'
                      : 'Manage extraction templates for this vendor'}
                  </p>
                  <Button size="sm" onClick={handleCreateTemplate}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                </div>

                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{template.name}</h4>
                            {template.isActive && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Used {template.invoiceCount} times</span>
                            {template.lastUsedAt && (
                              <span>
                                Last used{' '}
                                {new Date(template.lastUsedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="invoices">
                <p className="text-sm text-muted-foreground">
                  {vendor._count?.invoices || 0} invoices linked to this vendor
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  View and manage invoices from the main invoices page
                </p>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {vendor && (
        <TemplateEditor
          vendorId={vendor.id}
          template={selectedTemplate}
          open={templateEditorOpen}
          onOpenChange={setTemplateEditorOpen}
          onSuccess={handleTemplateSuccess}
        />
      )}
    </>
  );
}
