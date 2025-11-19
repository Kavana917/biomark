import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { demonstrateWatermarking, testWatermarkExtraction } from "@/lib/watermark-demo";
import { toast } from "sonner";

const WatermarkDemo = () => {
  const [showInvisible, setShowInvisible] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const demo = demonstrateWatermarking();

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
      if (char === '\u200B') {
        return <span key={index} className="bg-red-200 text-red-800 px-1 rounded text-xs">ZWS</span>;
      } else if (char === '\u200C') {
        return <span key={index} className="bg-blue-200 text-blue-800 px-1 rounded text-xs">ZWNJ</span>;
      } else if (char === '\u200D') {
        return <span key={index} className="bg-green-200 text-green-800 px-1 rounded text-xs">ZWJ</span>;
      }
      return char;
    });
  };

  return (
    <Card className="bg-card/30 backdrop-blur-md border-primary/20 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-orbitron text-xl font-semibold text-foreground">
          Zero-Width Character Watermarking Demo
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
              {demo.originalText.length} chars
            </Badge>
          </div>
          <div className="bg-muted/20 border border-muted rounded-lg p-4">
            <p className="font-mono text-sm text-foreground leading-relaxed">
              {demo.originalText}
            </p>
          </div>
          <Button
            onClick={() => handleCopy(demo.originalText)}
            variant="outline"
            size="sm"
            className="w-full font-mono"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Original
          </Button>
        </div>

        {/* Watermarked Text */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-sm font-medium text-foreground">Watermarked Document</h4>
            <Badge variant="outline" className="text-xs">
              {demo.watermarkedText.length} chars
            </Badge>
          </div>
          <div className="bg-muted/20 border border-muted rounded-lg p-4">
            <p className="font-mono text-sm text-foreground leading-relaxed">
              {renderTextWithMarkers(demo.watermarkedText)}
            </p>
          </div>
          <Button
            onClick={() => handleCopy(demo.watermarkedText)}
            variant="outline"
            size="sm"
            className="w-full font-mono"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy Watermarked
          </Button>
        </div>
      </div>

      {/* Watermark Data */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">Embedded Watermark Data</h4>
        <div className="bg-muted/20 border border-muted rounded-lg p-4">
          <pre className="font-mono text-xs text-foreground overflow-x-auto">
            {JSON.stringify(demo.watermarkData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Binary Representation */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">Binary Encoding</h4>
        <div className="bg-muted/20 border border-muted rounded-lg p-4">
          <p className="font-mono text-xs text-foreground break-all">
            {demo.binaryData}
          </p>
          <p className="font-mono text-xs text-muted-foreground mt-2">
            Length: {demo.binaryData.length} bits
          </p>
        </div>
      </div>

      {/* Zero-Width Characters */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">Zero-Width Characters Used</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="font-mono text-xs font-medium text-red-800">ZERO_WIDTH_SPACE</div>
            <div className="font-mono text-xs text-red-600">\u200B</div>
            <div className="font-mono text-xs text-red-500">Represents: 0</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="font-mono text-xs font-medium text-blue-800">ZERO_WIDTH_NON_JOINER</div>
            <div className="font-mono text-xs text-blue-600">\u200C</div>
            <div className="font-mono text-xs text-blue-500">Represents: 1</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="font-mono text-xs font-medium text-green-800">ZERO_WIDTH_JOINER</div>
            <div className="font-mono text-xs text-green-600">\u200D</div>
            <div className="font-mono text-xs text-green-500">Available for future use</div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">How It Works</h4>
        <div className="bg-muted/20 border border-muted rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs mt-1">1</Badge>
            <div>
              <p className="font-mono text-xs text-foreground font-medium">Convert watermark data to binary</p>
              <p className="font-mono text-xs text-muted-foreground">JSON → Binary string (8 bits per character)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs mt-1">2</Badge>
            <div>
              <p className="font-mono text-xs text-foreground font-medium">Embed using zero-width characters</p>
              <p className="font-mono text-xs text-muted-foreground">0 → \u200B (ZWS), 1 → \u200C (ZWNJ)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs mt-1">3</Badge>
            <div>
              <p className="font-mono text-xs text-foreground font-medium">Append to document text</p>
              <p className="font-mono text-xs text-muted-foreground">Invisible to users, preserved in file</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs mt-1">4</Badge>
            <div>
              <p className="font-mono text-xs text-foreground font-medium">Extract for verification</p>
              <p className="font-mono text-xs text-muted-foreground">Scan from end, convert back to binary → JSON</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test Extraction */}
      <div className="space-y-3">
        <h4 className="font-mono text-sm font-medium text-foreground">Test Extraction</h4>
        <Button
          onClick={() => {
            const extracted = testWatermarkExtraction(demo.watermarkedText);
            if (extracted) {
              toast.success("Watermark extracted successfully!");
              console.log("Extracted watermark:", extracted);
            } else {
              toast.error("Failed to extract watermark");
            }
          }}
          variant="outline"
          className="w-full font-mono"
        >
          Test Watermark Extraction
        </Button>
      </div>
    </Card>
  );
};

export default WatermarkDemo;

