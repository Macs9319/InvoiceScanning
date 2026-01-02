"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface RequestFiltersProps {
  onFilterChange: (filters: {
    search: string;
    status: string;
  }) => void;
}

export function RequestFilters({ onFilterChange }: RequestFiltersProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onFilterChange({ search: value, status });
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    onFilterChange({ search, status: value });
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus("all");
    onFilterChange({ search: "", status: "all" });
  };

  const hasActiveFilters = search !== "" || status !== "all";

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label htmlFor="search" className="mb-2 block text-sm font-medium">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by title or description..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="status" className="mb-2 block text-sm font-medium">
            Status
          </Label>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger id="status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
