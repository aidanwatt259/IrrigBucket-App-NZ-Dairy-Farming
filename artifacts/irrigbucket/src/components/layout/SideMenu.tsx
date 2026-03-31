import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { FileText, Trash2, ChevronRight, ClipboardList } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  getSavedReports, deleteReport, getReportLabel, getReportSubLabel, SavedReport,
} from '@/lib/savedReports';

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

export function SideMenu({ open, onClose }: SideMenuProps) {
  const [, setLocation] = useLocation();
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    if (open) setReports(getSavedReports());
  }, [open]);

  function handleOpen(id: string) {
    onClose();
    setLocation(`/reports/${id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteReport(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border/50">
          <SheetTitle className="text-lg font-display font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Previous Reports
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No saved reports yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Complete a test to save your first report.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 transition-colors text-left group"
                    onClick={() => handleOpen(report.id)}
                  >
                    <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {getReportLabel(report)}
                      </p>
                      {getReportSubLabel(report) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {getReportSubLabel(report)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, report.id)}
                        aria-label="Delete report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
