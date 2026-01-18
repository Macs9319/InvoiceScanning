import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface ScannedDocumentBadgeProps {
  textDensity?: number | null;
  showIcon?: boolean;
  className?: string;
}

export function ScannedDocumentBadge({
  textDensity,
  showIcon = true,
  className,
}: ScannedDocumentBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`border-orange-500 text-orange-700 dark:text-orange-400 ${className || ''}`}
      title={
        textDensity
          ? `Low text density: ${Math.round(textDensity)} chars/page - likely scanned document`
          : 'Scanned document detected - consider reprocessing with Vision API'
      }
    >
      {showIcon && <AlertTriangle className="mr-1 h-3 w-3" />}
      Scanned Document
    </Badge>
  );
}
