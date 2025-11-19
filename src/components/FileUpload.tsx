import { useRef } from "react";
import { Upload, Fingerprint, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label: string;
  accept: string;
  icon: "fingerprint" | "file";
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

const FileUpload = ({ label, accept, icon, file, onFileChange, disabled }: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    onFileChange(selectedFile);
  };

  const IconComponent = icon === "fingerprint" ? Fingerprint : FileText;

  return (
    <div className="space-y-2">
      <label className="font-mono text-sm text-muted-foreground">{label}</label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all duration-300",
          file
            ? "border-primary bg-primary/5 shadow-glow"
            : "border-muted hover:border-primary/50 bg-card/20",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "p-3 rounded-full transition-all",
            file ? "bg-primary/20" : "bg-muted"
          )}>
            {file ? (
              <Check className="w-6 h-6 text-primary" />
            ) : (
              <IconComponent className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          {file ? (
            <div className="text-center">
              <p className="font-mono text-sm text-primary font-medium">{file.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-mono text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {accept.split(',').join(', ')}
              </p>
            </div>
          )}

          <Button
            onClick={handleClick}
            disabled={disabled}
            variant="outline"
            size="sm"
            className="font-mono border-primary/30 hover:border-primary/50 hover:bg-primary/10"
          >
            <Upload className="w-4 h-4 mr-2" />
            {file ? "Change File" : "Browse"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
