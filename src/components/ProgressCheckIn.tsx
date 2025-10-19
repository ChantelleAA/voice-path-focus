import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface ProgressCheckInProps {
  open: boolean;
  onTick: () => void;
  onUnstuck: () => void;
}

export const ProgressCheckIn = ({ open, onTick, onUnstuck }: ProgressCheckInProps) => {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-semibold">Still on track?</h2>
          <p className="text-muted-foreground">
            How's your progress going?
          </p>
          
          <div className="flex gap-4 justify-center pt-4">
            <Button
              size="lg"
              onClick={onTick}
              className="gap-2 flex-1"
            >
              <Check className="w-5 h-5" />
              Yes, going well
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={onUnstuck}
              className="gap-2 flex-1"
            >
              <X className="w-5 h-5" />
              Need help
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
