import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";

const AboutSection = () => {
  return (
    <Card className="mt-12 bg-card/30 backdrop-blur-md border-primary/20 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-3 bg-primary/10 rounded-lg">
          <Info className="w-6 h-6 text-primary" />
        </div>
        
        <div className="space-y-4">
          <h2 className="font-orbitron text-2xl font-semibold text-foreground">
            About the Project
          </h2>
          
          <p className="font-mono text-sm md:text-base text-muted-foreground leading-relaxed">
            This project integrates biometric fingerprint data with digital watermarking for secure 
            document authentication. It prevents unauthorized duplication and ensures verifiable ownership. 
            The system uses advanced fuzzy vault technology to extract minutiae features from fingerprints, 
            generating unique cryptographic keys that are embedded into text documents as invisible watermarks.
          </p>

          <div className="pt-4 border-t border-primary/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <p className="text-muted-foreground">Developed by:</p>
                <p className="text-foreground font-medium">Kavana S [1AM23CS080]</p>
              </div>
              <div>
                <p className="text-muted-foreground">Project Guide:</p>
                <p className="text-foreground font-medium">Prof. Mala</p>
              </div>
              <div>
                <p className="text-muted-foreground">Institution:</p>
                <p className="text-foreground font-medium">AMC Engineering College</p>
              </div>
              <div>
                <p className="text-muted-foreground">Academic Year:</p>
                <p className="text-foreground font-medium">2023-2027</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AboutSection;
