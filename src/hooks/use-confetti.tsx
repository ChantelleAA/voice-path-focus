import confetti from 'canvas-confetti';


export const useConfetti = () => {
    const triggerConfetti = () => {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#fb923c', '#f59e0b', '#10b981', '#3b82f6', '#7c3aed'],
        });
    
        setTimeout(() => {
          confetti({
            particleCount: 60,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#f97316', '#60a5fa', '#34d399'],
          });
        }, 250);
      };

    return { triggerConfetti };
};
