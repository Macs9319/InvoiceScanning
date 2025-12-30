"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Template {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  customPrompt?: string;
  customFields?: string;
  fieldMappings?: string;
  validationRules?: string;
}

interface TemplateEditorProps {
  vendorId: string;
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TemplateEditor({ vendorId, template, open, onOpenChange, onSuccess }: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    customPrompt: '',
    customFieldsJson: '[]',
    fieldMappingsJson: '{}',
    validationRulesJson: '[]',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        isActive: template.isActive,
        customPrompt: template.customPrompt || '',
        customFieldsJson: template.customFields || '[]',
        fieldMappingsJson: template.fieldMappings || '{}',
        validationRulesJson: template.validationRules || '[]',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        isActive: true,
        customPrompt: '',
        customFieldsJson: '[]',
        fieldMappingsJson: '{}',
        validationRulesJson: '[]',
      });
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Parse and validate JSON fields
      let customFields, fieldMappings, validationRules;
      try {
        customFields = JSON.parse(formData.customFieldsJson);
        fieldMappings = JSON.parse(formData.fieldMappingsJson);
        validationRules = JSON.parse(formData.validationRulesJson);
      } catch (jsonError) {
        throw new Error('Invalid JSON in custom fields, mappings, or validation rules');
      }

      const endpoint = template
        ? `/api/vendors/${vendorId}/templates/${template.id}`
        : `/api/vendors/${vendorId}/templates`;

      const method = template ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          isActive: formData.isActive,
          customPrompt: formData.customPrompt || undefined,
          customFields: customFields.length > 0 ? customFields : undefined,
          fieldMappings: Object.keys(fieldMappings).length > 0 ? fieldMappings : undefined,
          validationRules: validationRules.length > 0 ? validationRules : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit' : 'Create'} Template</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit}>
            <ScrollArea className="h-[500px] pr-4">
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">
                    Template Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Invoice Template"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description of this template"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Active Template</Label>
                    <p className="text-sm text-muted-foreground">
                      Use this template for invoice processing
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="prompt" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="customPrompt">Custom Extraction Instructions</Label>
                  <Textarea
                    id="customPrompt"
                    value={formData.customPrompt}
                    onChange={(e) => setFormData({ ...formData, customPrompt: e.target.value })}
                    placeholder="Add vendor-specific instructions for the AI...&#10;Example:&#10;- This vendor uses 'Order No.' instead of 'Invoice No.'&#10;- Tax is always listed as 'VAT'&#10;- Pay special attention to discount codes"
                    rows={12}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    These instructions will be added to the AI extraction prompt for this vendor
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="customFields">Custom Fields (JSON)</Label>
                  <Textarea
                    id="customFields"
                    value={formData.customFieldsJson}
                    onChange={(e) => setFormData({ ...formData, customFieldsJson: e.target.value })}
                    placeholder='[{"name": "orderNumber", "type": "string", "required": true, "description": "PO Number"}]'
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Define additional fields to extract
                  </p>
                </div>

                <div>
                  <Label htmlFor="fieldMappings">Field Mappings (JSON)</Label>
                  <Textarea
                    id="fieldMappings"
                    value={formData.fieldMappingsJson}
                    onChange={(e) => setFormData({ ...formData, fieldMappingsJson: e.target.value })}
                    placeholder='{"orderNumber": "invoiceNumber", "amountDue": "totalAmount"}'
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Map vendor-specific field names to standard fields
                  </p>
                </div>

                <div>
                  <Label htmlFor="validationRules">Validation Rules (JSON)</Label>
                  <Textarea
                    id="validationRules"
                    value={formData.validationRulesJson}
                    onChange={(e) => setFormData({ ...formData, validationRulesJson: e.target.value })}
                    placeholder='[{"field": "totalAmount", "rule": "min", "value": 0, "message": "Amount must be positive"}]'
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Define validation rules for extracted data
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">JSON Format Examples:</p>
                  <div className="space-y-2 text-xs font-mono">
                    <p className="text-muted-foreground">
                      Custom Fields: name, type (string|number|boolean|date), required, description
                    </p>
                    <p className="text-muted-foreground">
                      Field Mappings: vendorFieldName: standardFieldName
                    </p>
                    <p className="text-muted-foreground">
                      Validation: field, rule (min|max|pattern|required|length), value, message
                    </p>
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mt-4">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : template ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
