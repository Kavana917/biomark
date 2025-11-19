import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BiometricEncryptionService } from "@/lib/biometric";
import { toast } from "sonner";

const WatermarkComparison = () => {
  const [showInvisible, setShowInvisible] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const encryptionService = new BiometricEncryptionService();
  const test = encryptionService.testWatermarking();

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const renderTextWithMarkers = (text: string) => {
    if (!showInvisible) return text;
    
    return text.split('').map((char, index) => {
      const charCode = char.charCodeAt(0);
      if (char === '\uFEFF') {
        return <span key={index} className="bg-yellow-200 text-yellow-800 px-1 rounded text-xs">MARKER</span>;
      } else if (charCode >= 0xE000 && charCode <= 0xF8FF) {
        return <span key={index} className="bg-purple-200 text-purple-800 px-1 rounded text-xs">WM</span>;
      }
      return char;
    });
  };

  return (
    <Card className="bg-card/30 backdrop-blur-md border-primary/20 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-orbitron text-xl font-semibold text-foreground">
          Watermarking Comparison
        </h3>
        <Button
          onClick={() => setShowInvisible(!showInvisible)}
          variant="outline"
          size="sm"
          className="font-mono border-primary/30 hover:border-primary/50 hover:bg-primary/10"
        >
          {showInvisible ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              Hide Invisible
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Show Invisible
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original Text */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-sm font-medium text-foreground">Original Document</h4>
            <Badge variant="outline" className="text-xs">
              {test.original.length} chars
            </Badge>
          </div>
          <div className="bg-muted/20 border border-muted rounded-lg p-4">
            <p className="font-mono text-sm text-foreground leading-relaxed">
              {test.original}
            </p>
          </div>
          <Button
            onClick={() => handleCopy(test.original)}
            variant="outline"
            size="sm"
            className="w-full font-mono"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Original
          </Button>
        </div>

        {/* Watermarked Text (User Visible) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-sm font-medium text-foreground">Watermarked Document</h4>
            <Badge variant="outline" className="text-xs">
              {test.userVisible.length} chars visible
            </Badge>
          </div>
          <div className="bg-muted/20 border border-muted rounded-lg p-4">
            <p className="font-mono text-sm text-foreground leading-relaxed">
              {test.userVisible}
            </p>
          </div>
          <Button
            onClick={() => handleCopy(test.userVisible)}
            variant="outline"
            size="sm"
            className="w-full font-mono"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Watermarked
          </Button>
        </div>
      </div>

      {/* Raw Watermarked Text (with invisible chars) */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">Raw Watermarked Text (with invisible characters)</h4>
        <div className="bg-muted/20 border border-muted rounded-lg p-4">
          <p className="font-mono text-sm text-foreground leading-relaxed">
            {renderTextWithMarkers(test.watermarked)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Total length: {test.watermarked.length} characters</span>
          <span>Hidden chars: {test.watermarked.length - test.userVisible.length}</span>
          <span className="text-primary">Identical to original: {test.userVisible === test.original ? "✅ Yes" : "❌ No"}</span>
        </div>
      </div>

      {/* Key Points */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <h4 className="font-mono text-sm font-medium text-primary mb-3">Key Points:</h4>
        <ul className="space-y-2 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>The watermarked document looks <strong>identical</strong> to the original to users</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Invisible zero-width characters contain the biometric watermark data</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>When you download the file, it contains the original text + hidden watermark</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Verification extracts the hidden data to prove ownership</span>
          </li>
        </ul>
      </div>
    </Card>
  );
};

export default WatermarkComparison;
