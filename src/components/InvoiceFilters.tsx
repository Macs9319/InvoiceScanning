"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface FilterState {
  search: string;
  status: string;
  currency: string;
  vendorId: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface InvoiceFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  vendors?: Vendor[];
}

export function InvoiceFilters({
  filters,
  onFilterChange,
  onClearFilters,
  vendors = [],
}: InvoiceFiltersProps) {
  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.currency !== "all" ||
    filters.vendorId !== "all" ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.minAmount ||
    filters.maxAmount;

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, description..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status}
          onValueChange={(value) => updateFilter("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Currency Filter */}
        <Select
          value={filters.currency}
          onValueChange={(value) => updateFilter("currency", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Currencies</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="GBP">GBP</SelectItem>
            <SelectItem value="JPY">JPY</SelectItem>
            <SelectItem value="CAD">CAD</SelectItem>
            <SelectItem value="AUD">AUD</SelectItem>
          </SelectContent>
        </Select>

        {/* Vendor Filter */}
        <Select
          value={filters.vendorId}
          onValueChange={(value) => updateFilter("vendorId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <Input
          type="date"
          placeholder="From date"
          value={filters.dateFrom}
          onChange={(e) => updateFilter("dateFrom", e.target.value)}
        />
        <Input
          type="date"
          placeholder="To date"
          value={filters.dateTo}
          onChange={(e) => updateFilter("dateTo", e.target.value)}
        />

        {/* Amount Range */}
        <Input
          type="number"
          placeholder="Min amount"
          value={filters.minAmount}
          onChange={(e) => updateFilter("minAmount", e.target.value)}
          min="0"
          step="0.01"
        />
        <Input
          type="number"
          placeholder="Max amount"
          value={filters.maxAmount}
          onChange={(e) => updateFilter("maxAmount", e.target.value)}
          min="0"
          step="0.01"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
