// In your GameOverScene or wherever you handle score submission
export class GameOverScene extends Phaser.Scene {
    create() {
        // ... your existing code ...
        
        // Get wallet address when submitting score
        const walletAddress = window.solana?.publicKey?.toString();
        
        if (walletAddress) {
            this.submitScoreWithWallet(this.finalScore, walletAddress);
        } else {
            // Fallback to anonymous score or prompt wallet connection
            this.submitScore(this.finalScore);
        }
    }
    
    submitScoreWithWallet(score, walletAddress) {
        // Submit to your existing API with wallet address
        fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'submitScore',
                score: score,
                walletAddress: walletAddress,
                timestamp: new Date().toISOString()
            })
        });
    }
}