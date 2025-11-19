import { useState } from "react";
import { Eye, EyeOff, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { readDocumentAsPlainText } from "@/lib/docx-handler";

interface FilePreviewProps {
  file: File | null;
  type: "fingerprint" | "document";
  className?: string;
}

const FilePreview = ({ file, type, className }: FilePreviewProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>("");

  const handlePreview = async () => {
    if (!file) return;

    if (type === "fingerprint") {
      // For images, create a preview URL
      const url = URL.createObjectURL(file);
      setPreviewContent(url);
    } else {
      try {
        const { text } = await readDocumentAsPlainText(file);
        setPreviewContent(text);
      } catch (error) {
        console.error("Failed to preview document", error);
        setPreviewContent("Unable to preview this document type.");
      }
    }
    setShowPreview(true);
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    if (type === "fingerprint" && previewContent) {
      URL.revokeObjectURL(previewContent);
    }
    setPreviewContent("");
  };

  if (!file) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-muted-foreground">
          {type === "fingerprint" ? "Fingerprint Preview" : "Document Preview"}
        </span>
        <Button
          onClick={showPreview ? handleClosePreview : handlePreview}
          variant="outline"
          size="sm"
          className="font-mono border-primary/30 hover:border-primary/50 hover:bg-primary/10"
        >
          {showPreview ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Hide
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </>
          )}
        </Button>
      </div>

      {showPreview && (
        <Card className="bg-card/50 backdrop-blur-md border-primary/20 p-4">
          {type === "fingerprint" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image className="w-4 h-4" />
                <span>Fingerprint Image</span>
              </div>
              <div className="relative">
                <img
                  src={previewContent}
                  alt="Fingerprint preview"
                  className="max-w-full h-auto max-h-48 rounded border border-primary/20"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>Document Content</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
                  {previewContent}
                </pre>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default FilePreview;

