import { Fingerprint, ScanLine, Key, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  icon: string;
  text: string;
}

interface ProgressDisplayProps {
  steps: ProgressStep[];
  currentStep: number;
  isProcessing: boolean;
}

const iconMap = {
  fingerprint: Fingerprint,
  scan: ScanLine,
  key: Key,
  shield: Shield,
  check: CheckCircle2,
};

const ProgressDisplay = ({ steps, currentStep, isProcessing }: ProgressDisplayProps) => {
  return (
    <div className="space-y-4">
      <h3 className="font-orbitron text-lg font-semibold text-foreground mb-4">
        Process Status
      </h3>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const IconComponent = iconMap[step.icon as keyof typeof iconMap] || CheckCircle2;
          const isActive = index < currentStep;
          const isCurrent = index === currentStep - 1 && isProcessing;

          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all duration-500",
                isActive
                  ? "border-primary/50 bg-primary/5 shadow-glow"
                  : "border-muted bg-card/10",
                isCurrent && "animate-glow-pulse"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isActive ? "bg-primary/20" : "bg-muted"
                )}
              >
                <IconComponent
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>

              <p
                className={cn(
                  "font-mono text-sm transition-colors",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {step.text}
              </p>

              {isCurrent && (
                <div className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isProcessing && currentStep === 0 && (
        <div className="text-center py-8">
          <p className="font-mono text-sm text-muted-foreground">
            Upload files and start the process
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgressDisplay;
