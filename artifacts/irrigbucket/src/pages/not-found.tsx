import { Droplet } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-primary/10 p-2 rounded-xl text-primary">
          <Droplet className="w-5 h-5 fill-primary" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">
          Irrig<span className="text-primary">Bucket</span>
        </span>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-foreground">Page not found</h1>
          <p className="text-muted-foreground">
            That link doesn&apos;t match a page in IrrigBucket. Head back home to start a bucket test.
          </p>
          <Button size="lg" className="w-full" onClick={() => setLocation("/")}>
            Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
