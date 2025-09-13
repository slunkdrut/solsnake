import * as Phaser from "phaser";
import { StateClient } from './mockStateClient.js';

const client = new StateClient({
  baseURL: 'https://state.dev.fun',
  appId: '2fab5b437cf7dda4bc46'
});

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Generate textures for snake and food
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x00ff41, 1);
    graphics.fillRect(0, 0, 20, 20);
    graphics.generateTexture("snakeBody", 20, 20);
    graphics.clear();
    graphics.fillStyle(0xff4444, 1);
    graphics.fillRect(0, 0, 20, 20);
    graphics.generateTexture("food", 20, 20);
    graphics.clear();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 4, 4);
    graphics.generateTexture("particle", 4, 4);
    graphics.destroy();

    // Load local audio files
    this.load.audio("bgMusic", "/assets/evilquent.mp3");
    this.load.audio("biteSound", "/assets/bite.mp3");
    
    this.load.setTimeout = 5000;
  }

  create() {
    try {
      if (this.cache.audio.exists("bgMusic")) {
        this.bgMusic = this.sound.add("bgMusic", {
          loop: true,
          volume: 0.3
        });
        try {
          this.bgMusic.play();
        } catch (playError) {
          console.log("Audio autoplay prevented:", playError);
          this.enableAudioOnInteraction();
        }
      }
    } catch (error) {
      console.error("Error initializing background music:", error);
    }
    this.scene.start("MenuScene");
  }

  enableAudioOnInteraction() {
    const enableAudio = () => {
      if (this.bgMusic && !this.bgMusic.isPlaying) {
        try {
          this.bgMusic.play();
        } catch (error) {
          console.log("Could not play background music:", error);
        }
      }
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('click', enableAudio);
    };
    document.addEventListener('touchstart', enableAudio);
    document.addEventListener('click', enableAudio);
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
    this.walletAddress = "";
    this.xUsername = "";
    this.phantom = null;
    this.solanaLoaded = false;
  }

  async create() {
    const { width, height } = this.scale;
    this.hasPaid = false;
    this.receivingWallet = "5pLqMhYx9zmsdCAsRRcTMtEahFzGvQAfs2CzPfeTF14L";
    const isMobile = width < 800;
    const isActualMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isPhantomBrowser = window.solana && window.solana.isPhantom;

    // Use text fallback instead of external logo
    this.add.text(width / 2, isMobile ? height * 0.05 : height * 0.1, "SOLSNAKE", {
      fontSize: isMobile ? "20px" : "32px",
      color: "#00ff41",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.add.text(width / 2, isMobile ? height * 0.11 : height * 0.18, "🐍 The Most Degenerate Snake Game in Crypto! 🐍", {
      fontSize: isMobile ? "12px" : "18px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    // Daily prize text
    this.dailyPrizeText = this.add.text(width / 2, isMobile ? height * 0.19 : height * 0.24, "Daily Prize: 0.000 SOL", {
      fontSize: isMobile ? "14px" : "16px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    // Connect wallet button
    this.connectWalletButton = this.add.rectangle(width / 2, isMobile ? height * 0.25 : height * 0.30, isMobile ? 280 : 300, isMobile ? 40 : 50, 0x8a2be2);
    this.connectWalletButton.setStrokeStyle(3, 0xffffff);
    let connectText = "CONNECT PHANTOM WALLET";
    if (isActualMobile) {
      connectText = isPhantomBrowser ? "CONNECT WALLET" : "OPEN IN PHANTOM BROWSER";
    }
    this.connectWalletText = this.add.text(width / 2, isMobile ? height * 0.25 : height * 0.30, connectText, {
      fontSize: isMobile ? "12px" : "16px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);
    this.connectWalletButton.setInteractive();
    this.connectWalletButton.on('pointerdown', () => {
      if (this.walletAddress) {
        this.disconnectWallet();
      } else {
        this.connectPhantomWallet();
      }
    });

    this.walletStatusText = this.add.text(width / 2, isMobile ? height * 0.31 : height * 0.36, isActualMobile && !isPhantomBrowser ? "For best experience, use Phantom browser" : "Connect wallet to continue", {
      fontSize: isMobile ? "10px" : "14px",
      color: "#888888",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    // Payment section
    this.paymentStatusText = this.add.text(width / 2, isMobile ? height * 0.37 : height * 0.38, "💰 PAYMENT REQUIRED 💰", {
      fontSize: isMobile ? "14px" : "20px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.add.text(width / 2, isMobile ? height * 0.41 : height * 0.42, "Cost: 0.01 SOL daily pass - play unlimited games", {
      fontSize: isMobile ? "10px" : "14px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    this.paymentButton = this.add.rectangle(width / 2, isMobile ? height * 0.46 : height * 0.46, isMobile ? 220 : 250, isMobile ? 40 : 50, 0x666666);
    this.paymentButton.setStrokeStyle(3, 0x888888);
    this.paymentButtonText = this.add.text(width / 2, isMobile ? height * 0.46 : height * 0.46, "PAY 0.01 SOL", {
      fontSize: isMobile ? "13px" : "18px",
      color: "#888888",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);
    this.paymentButton.setInteractive();
    this.paymentButton.on('pointerdown', () => {
      this.processPayment();
    });

    // X username input
    this.add.text(width / 2, isMobile ? height * 0.53 : height * 0.52, "X.com username (optional):", {
      fontSize: isMobile ? "12px" : "16px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    const xInputBg = this.add.rectangle(width / 2, isMobile ? height * 0.57 : height * 0.56, isMobile ? 260 : 300, isMobile ? 30 : 40, 0x333333);
    xInputBg.setStrokeStyle(2, 0x1da1f2);
    this.xText = this.add.text(width / 2, isMobile ? height * 0.57 : height * 0.56, "Click to enter X username", {
      fontSize: isMobile ? "11px" : "14px",
      color: "#888888",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    xInputBg.setInteractive();
    xInputBg.on('pointerdown', () => {
      const username = prompt("Enter your X.com username (without @):");
      if (username) {
        this.xUsername = username;
        this.xText.setText(`@${username}`);
        this.xText.setColor("#1da1f2");
      }
    });

    // Play button
    this.playButton = this.add.rectangle(width / 2, isMobile ? height * 0.64 : height * 0.62, isMobile ? 180 : 200, isMobile ? 40 : 50, 0x666666);
    this.playButton.setStrokeStyle(3, 0x888888);
    this.playButtonText = this.add.text(width / 2, isMobile ? height * 0.64 : height * 0.62, "PLAY", {
      fontSize: isMobile ? "16px" : "24px",
      color: "#888888",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);
    this.playButton.setInteractive();
    this.playButton.on('pointerdown', async () => {
      if (!this.walletAddress) {
        alert("Please connect your Phantom wallet first!");
        return;
      }
      await this.checkDailyPayment();
      if (!this.hasPaid) {
        alert("Please pay 0.01 SOL first to play!");
        return;
      }
      this.scene.start("GameScene", {
        wallet: this.walletAddress,
        xUsername: this.xUsername
      });
    });

    // Leaderboard button
    const leaderboardButton = this.add.rectangle(width / 2, isMobile ? height * 0.71 : height * 0.68, isMobile ? 180 : 200, isMobile ? 34 : 40, 0x333333);
    leaderboardButton.setStrokeStyle(2, 0x00ff41);
    this.add.text(width / 2, isMobile ? height * 0.71 : height * 0.68, "LEADERBOARD", {
      fontSize: isMobile ? "13px" : "16px",
      color: "#00ff41",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    leaderboardButton.setInteractive();
    leaderboardButton.on('pointerdown', () => {
      this.scene.start("LeaderboardScene");
    });

    this.add.text(width / 2, isMobile ? this.scale.height * 0.76 : this.scale.height * 0.74, "(payouts may take from 1-24 hours after win)", {
      fontSize: isMobile ? "9px" : "12px",
      color: "#888888",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    this.add.text(width / 2, isMobile ? this.scale.height * 0.81 : this.scale.height * 0.78, "The player with the highest score at the end\nof the Daily Reset wins the Daily Pot!", {
      fontSize: isMobile ? "11px" : "16px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.updateDailyTimer();
    if (!isActualMobile) {
      this.checkPhantomWallet();
    }
    this.time.delayedCall(100, () => {
      this.updateDailyPrize();
    });
    this.time.delayedCall(200, () => {
      this.correctExistingWinners();
    });
  }

  async correctExistingWinners() {
    try {
      const allWinners = await client.getEntities('daily_winners');
      const winnersToCorrect = [];
      for (const winner of allWinners) {
        const date = winner.date;
        if (!date) continue;
        try {
          const scores = await client.getEntities('players', { date: date });
          if (scores.length > 0) {
            scores.sort((a, b) => b.score - a.score);
            const actualWinner = scores[0];
            if (winner.score !== actualWinner.score) {
              winnersToCorrect.push({ winner, actualWinner, date });
            }
          }
        } catch (error) {
          console.error(`Error checking scores for ${date}:`, error);
        }
      }
      for (const { winner, actualWinner, date } of winnersToCorrect) {
        try {
          let dailyPot = 0;
          const payments = await client.getEntities('daily_payments', { date: date });
          const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
          dailyPot = totalCollected * 0.9;
          await client.updateEntity('daily_winners', winner.id, {
            wallet: actualWinner.wallet,
            xUsername: actualWinner.xUsername || "",
            score: actualWinner.score,
            date: date,
            timestamp: winner.timestamp,
            dailyPot: dailyPot
          });
          console.log(`Corrected winner for ${date}: ${winner.score} -> ${actualWinner.score}`);
        } catch (error) {
          console.error(`Error correcting winner for ${date}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in correctExistingWinners:", error);
    }
  }

  async updateDailyPrize() {
    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const today = mountainTime.toISOString().split('T')[0];
      const todayPayments = await client.getEntities('daily_payments', { date: today });
      const totalCollected = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const dailyPrize = totalCollected * 0.9;
      if (this.dailyPrizeText && !this.dailyPrizeText.scene) {
        this.dailyPrizeText = null;
      }
      if (this.dailyPrizeText) {
        this.dailyPrizeText.setText(`Daily Prize: ${dailyPrize.toFixed(3)} SOL`);
      }
    } catch (error) {
      console.error("Error loading daily prize:", error);
      if (this.dailyPrizeText && !this.dailyPrizeText.scene) {
        this.dailyPrizeText = null;
      }
      if (this.dailyPrizeText) {
        this.dailyPrizeText.setText("Daily Prize: 0.000 SOL");
      }
    }
  }

  loadSolanaWeb3() {
    return new Promise((resolve, reject) => {
      if (window.solanaWeb3 || this.solanaLoaded) {
        this.solanaLoaded = true;
        resolve();
        return;
      }
      if (typeof window.Buffer === 'undefined') {
        window.Buffer = class Buffer extends Uint8Array {
          constructor(arg, encoding) {
            if (typeof arg === 'number') {
              super(arg);
            } else if (typeof arg === 'string') {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(arg);
              super(bytes);
              this.set(bytes);
            } else if (arg instanceof ArrayBuffer || arg instanceof Uint8Array) {
              super(arg);
            } else {
              super(0);
            }
          }
          static from(data, encoding) {
            return new Buffer(data, encoding);
          }
          static alloc(size, fill = 0) {
            const buf = new Buffer(size);
            buf.fill(fill);
            return buf;
          }
          toString(encoding = 'utf8') {
            if (encoding === 'base64') {
              return btoa(String.fromCharCode(...this));
            }
            const decoder = new TextDecoder(encoding);
            return decoder.decode(this);
          }
        };
        window.Buffer.isBuffer = obj => obj instanceof window.Buffer;
        window.Buffer.concat = buffers => {
          const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
          const result = new window.Buffer(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            result.set(buf, offset);
            offset += buf.length;
          }
          return result;
        };
      }
      if (typeof global === 'undefined') {
        window.global = window;
      }
      global.Buffer = window.Buffer;
      console.log('Enhanced Buffer polyfill loaded for mobile');
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@solana/web3.js@1.78.0/lib/index.iife.min.js';
      const timeout = setTimeout(() => {
        reject(new Error('Solana Web3 load timeout'));
      }, 10000);
      script.onload = () => {
        clearTimeout(timeout);
        console.log('Solana Web3 loaded successfully');
        this.solanaLoaded = true;
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load Solana Web3'));
      };
      document.head.appendChild(script);
    });
  }

  async checkPhantomWallet() {
    if (window.solana && window.solana.isPhantom) {
      this.phantom = window.solana;
      try {
        if (this.phantom.isConnected) {
          this.walletAddress = this.phantom.publicKey.toString();
          this.updateWalletUI();
        }
      } catch (error) {
        console.log("Wallet not connected yet");
      }
    }
  }

  async connectPhantomWallet() {
    const isActualMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isPhantomBrowser = window.solana && window.solana.isPhantom;
    if (isActualMobile && !isPhantomBrowser) {
      const currentUrl = window.location.href;
      const phantomUrl = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(currentUrl)}`;
      window.open(phantomUrl, "_blank");
      return;
    }
    if (!isPhantomBrowser) {
      alert("Phantom wallet not found! Please install Phantom wallet extension.");
      window.open("https://phantom.app/", "_blank");
      return;
    }
    if (!this.solanaLoaded) {
      this.connectWalletText.setText("LOADING...");
      try {
        await this.loadSolanaWeb3();
      } catch (error) {
        console.error('Failed to load Solana Web3:', error);
        this.connectWalletText.setText("CONNECT PHANTOM WALLET");
        alert("Failed to load wallet dependencies. Please refresh and try again.");
        return;
      }
    }
    try {
      this.phantom = window.solana;
      const response = await this.phantom.connect();
      this.walletAddress = response.publicKey.toString();
      this.updateWalletUI();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      this.connectWalletText.setText("CONNECT PHANTOM WALLET");
      alert("Failed to connect to Phantom wallet!");
    }
  }

  async disconnectWallet() {
    try {
      if (this.phantom && this.phantom.disconnect) {
        await this.phantom.disconnect();
      }
      this.walletAddress = "";
      this.phantom = null;
      this.hasPaid = false;
      this.updateDisconnectedUI();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      this.walletAddress = "";
      this.phantom = null;
      this.hasPaid = false;
      this.updateDisconnectedUI();
    }
  }

  updateWalletUI() {
    this.connectWalletText.setText("✓ WALLET CONNECTED");
    this.connectWalletButton.setFillStyle(0x00ff41);
    this.walletStatusText.setText(`${this.walletAddress.substring(0, 8)}...`);
    this.walletStatusText.setColor("#00ff41");
    this.paymentButton.setFillStyle(0xffff00);
    this.paymentButton.setStrokeStyle(3, 0x000000);
    this.paymentButtonText.setColor("#000000");
    
    // Check payment status when wallet connects
    this.checkDailyPayment();
  }

  updateDisconnectedUI() {
    this.connectWalletText.setText("CONNECT PHANTOM WALLET");
    this.connectWalletButton.setFillStyle(0x8a2be2);
    this.connectWalletButton.setStrokeStyle(3, 0xffffff);
    this.walletStatusText.setText("Connect wallet to continue");
    this.walletStatusText.setColor("#888888");
    this.paymentStatusText.setText("💰 PAYMENT REQUIRED 💰");
    this.paymentStatusText.setColor("#ffff00");
    this.paymentButton.setFillStyle(0x666666);
    this.paymentButton.setStrokeStyle(3, 0x888888);
    this.paymentButtonText.setText("PAY 0.01 SOL");
    this.paymentButtonText.setColor("#888888");
    this.playButton.setFillStyle(0x666666);
    this.playButton.setStrokeStyle(3, 0x888888);
    this.playButtonText.setColor("#888888");
    if (this.goodLuckText) {
      this.goodLuckText.destroy();
      this.goodLuckText = null;
    }
  }

  async checkDailyPayment() {
    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const today = mountainTime.toISOString().split('T')[0];
      const paymentId = `${this.walletAddress}_${today}`;
      
      // Clear old payment cache if it's from a different day
      const lastPaymentDate = localStorage.getItem('lastPaymentDate');
      if (lastPaymentDate && lastPaymentDate !== today) {
        // Clear all payment cache for old dates
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('payment_') && !key.includes(today)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem('lastPaymentDate', today);
      }
      
      // First check localStorage for cached payment status
      const cachedPayment = localStorage.getItem(`payment_${paymentId}`);
      if (cachedPayment) {
        const paymentData = JSON.parse(cachedPayment);
        if (paymentData.confirmed && paymentData.date === today) {
          this.hasPaid = true;
          this.updatePaymentUI();
          console.log("Payment found in cache for today");
          return;
        }
      }
      
      // If not in cache, check the database
      const payment = await client.getEntity('daily_payments', paymentId);
      if (payment && payment.confirmed) {
        this.hasPaid = true;
        this.updatePaymentUI();
        // Cache the payment status
        localStorage.setItem(`payment_${paymentId}`, JSON.stringify(payment));
        localStorage.setItem('lastPaymentDate', today);
        console.log("Payment found in database for today");
      } else {
        this.hasPaid = false;
        console.log("No payment found for today");
      }
    } catch (error) {
      console.log("Error checking payment:", error);
      this.hasPaid = false;
    }
  }

  updatePaymentUI() {
    this.paymentStatusText.setText("PAYMENT RECEIVED");
    this.paymentStatusText.setColor("#00ff41");
    this.paymentButtonText.setText("✓ PAID TODAY");
    this.paymentButtonText.setColor("#00ff41");
    this.paymentButton.setFillStyle(0x00ff41);
    this.paymentButton.setStrokeStyle(3, 0xffffff);
    this.playButton.setFillStyle(0x00ff41);
    this.playButton.setStrokeStyle(3, 0xffffff);
    this.playButtonText.setColor("#000000");
    if (this.goodLuckText) {
      this.goodLuckText.destroy();
    }
    const isMobile = this.scale.width < 800;
    const { width } = this.scale;
    this.goodLuckText = this.add.text(width / 2, isMobile ? this.scale.height * 0.46 : this.scale.height * 0.465, "GOOD LUCK!", {
      fontSize: isMobile ? "11px" : "14px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);
  }

  async processPayment() {
    if (!this.walletAddress) {
      alert("Please connect your Phantom wallet first!");
      return;
    }
    if (this.hasPaid) {
      alert("You have already paid for today!");
      return;
    }
    if (!this.solanaLoaded) {
      this.paymentButtonText.setText("LOADING...");
      try {
        await this.loadSolanaWeb3();
      } catch (error) {
        console.error('Failed to load Solana Web3:', error);
        this.paymentButtonText.setText("PAY 0.01 SOL");
        alert("Failed to load payment dependencies. Please refresh and try again.");
        return;
      }
    }
    try {
      if (!this.phantom || !this.phantom.isConnected) {
        alert("Phantom wallet not connected!");
        return;
      }
      if (!window.solanaWeb3) {
        alert("Solana library not loaded. Please refresh and try again.");
        return;
      }
      this.paymentButtonText.setText("PROCESSING...");
      this.paymentButton.setFillStyle(0x888888);
      console.log("Starting payment process...");
      console.log("From wallet:", this.walletAddress);
      console.log("To wallet:", this.receivingWallet);
      console.log("Amount: 0.01 SOL");
      const connection = new window.solanaWeb3.Connection('https://autumn-cool-research.solana-mainnet.quiknode.pro/d0e8d80ee0f8b5f35291b9261dab71e9afc9d607/', 'confirmed');
      const fromPubkey = new window.solanaWeb3.PublicKey(this.walletAddress);
      const toPubkey = new window.solanaWeb3.PublicKey(this.receivingWallet);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      console.log("Got blockhash:", blockhash);
      const solAmount = 0.01;
      const lamportsPerSol = 1000000000;
      const lamportsAmount = Math.floor(solAmount * lamportsPerSol);
      console.log("Lamports amount:", lamportsAmount, "Type:", typeof lamportsAmount);
      const transaction = new window.solanaWeb3.Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey
      });
      const transferInstruction = window.solanaWeb3.SystemProgram.transfer({
        fromPubkey: fromPubkey,
        toPubkey: toPubkey,
        lamports: lamportsAmount
      });
      transaction.add(transferInstruction);
      console.log("Transaction created, requesting signature...");
      const signedTransaction = await this.phantom.signAndSendTransaction(transaction, {
        commitment: 'confirmed'
      });
      console.log("Transaction sent:", signedTransaction.signature);
      this.paymentButtonText.setText("CONFIRMING...");
      const confirmation = await connection.confirmTransaction({
        signature: signedTransaction.signature,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight
      }, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      console.log("Transaction confirmed");
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const today = mountainTime.toISOString().split('T')[0];
      const paymentId = `${this.walletAddress}_${today}`;
      const paymentData = {
        id: paymentId,
        wallet: this.walletAddress,
        amount: 0.01,
        date: today,
        signature: signedTransaction.signature,
        timestamp: Date.now(),
        confirmed: true
      };
      await client.createEntity('daily_payments', paymentData);
      console.log("Payment record saved");
      
      // Cache the payment status in localStorage
      localStorage.setItem(`payment_${paymentId}`, JSON.stringify(paymentData));
      
      this.hasPaid = true;
      this.updatePaymentUI();
      this.updateDailyPrize();
      alert(`✅ Payment successful!\n\n0.01 SOL sent to: ${this.receivingWallet}\n\nTransaction ID: ${signedTransaction.signature}\n\nYou now have unlimited plays until daily reset!`);
    } catch (error) {
      console.error("Payment failed:", error);
      this.paymentButtonText.setText("PAY 0.01 SOL");
      this.paymentButton.setFillStyle(0xffff00);
      let errorMessage = "❌ Payment failed!\n\n";
      if (error.message) {
        if (error.message.includes("User rejected") || error.message.includes("User declined") || error.message.includes("cancelled")) {
          errorMessage = "❌ Payment cancelled by user.";
        } else if (error.message.includes("insufficient") || error.message.includes("Insufficient")) {
          errorMessage = "❌ Insufficient SOL balance!\n\nYou need at least 0.01 SOL plus transaction fees to play.";
        } else if (error.message.includes("blockhash not found")) {
          errorMessage = "❌ Network error - blockhash expired.\n\nPlease try again.";
        } else {
          errorMessage += `Error: ${error.message}\n\nPlease try again or contact support.`;
        }
      } else if (error.code === 4001) {
        errorMessage = "❌ Payment cancelled by user.";
      } else {
        errorMessage += `Unexpected error: ${error}\n\nPlease try again or contact support.`;
      }
      alert(errorMessage);
    }
  }

  updateDailyTimer() {
    const now = new Date();
    const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
    const tomorrow = new Date(mountainTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeLeft = tomorrow - mountainTime;
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor(timeLeft % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(timeLeft % (1000 * 60) / 1000);
    if (mountainTime.getHours() === 0 && mountainTime.getMinutes() === 0 && mountainTime.getSeconds() < 2) {
      this.time.delayedCall(100, () => {
        this.handleDailyReset();
      });
    }
    if (this.timerText) {
      this.timerText.destroy();
    }
    const isMobile = this.scale.width < 800;
    this.timerText = this.add.text(this.scale.width / 2, isMobile ? this.scale.height * 0.86 : this.scale.height * 0.84, `Daily Reset: ${hours}h ${minutes}m ${seconds}s`, {
      fontSize: isMobile ? "12px" : "14px",
      color: "#ffff00",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    this.time.delayedCall(1000, () => this.updateDailyTimer());
  }

  async handleDailyReset() {
    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const yesterday = new Date(mountainTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const existingWinner = await client.getEntity('daily_winners', `winner_${yesterdayStr}`);
      const yesterdayScores = await client.getEntities('players', { date: yesterdayStr });
      if (yesterdayScores.length > 0) {
        yesterdayScores.sort((a, b) => b.score - a.score);
        const actualWinner = yesterdayScores[0];
        let dailyPot = 0;
        try {
          const yesterdayPayments = await client.getEntities('daily_payments', { date: yesterdayStr });
          const totalCollected = yesterdayPayments.reduce((sum, payment) => sum + payment.amount, 0);
          dailyPot = totalCollected * 0.9;
        } catch (error) {
          console.error("Error calculating daily pot:", error);
        }
        const winnerData = {
          wallet: actualWinner.wallet || "Unknown",
          xUsername: actualWinner.xUsername || "",
          score: actualWinner.score || 0,
          date: yesterdayStr,
          timestamp: Date.now(),
          dailyPot: dailyPot || 0
        };
        if (existingWinner) {
          console.log(`Updating past winner for ${yesterdayStr}: score ${winnerData.score}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.updateEntity('daily_winners', `winner_${yesterdayStr}`, winnerData);
        } else {
          console.log(`Creating new past winner for ${yesterdayStr}: score ${winnerData.score}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.createEntity('daily_winners', {
            id: `winner_${yesterdayStr}`,
            ...winnerData
          });
        }
      }
      if (this.walletAddress) {
        this.hasPaid = false;
        this.updateDisconnectedUI();
        this.time.delayedCall(100, () => {
          this.checkDailyPayment();
        });
      }
      this.time.delayedCall(200, () => {
        this.updateDailyPrize();
      });
    } catch (error) {
      console.error("Error handling daily reset:", error);
    }
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  init(data) {
    this.playerWallet = data.wallet;
    this.playerX = data.xUsername;
  }

  create() {
    const { width, height } = this.scale;
    this.gridSize = 20;
    this.gameWidth = Math.floor(width * 0.9 / this.gridSize) * this.gridSize;
    this.gameHeight = Math.floor(height * 0.8 / this.gridSize) * this.gridSize;
    this.offsetX = (width - this.gameWidth) / 2;
    this.offsetY = (height - this.gameHeight) / 2 + 30;

    const border = this.add.rectangle(width / 2, this.offsetY + this.gameHeight / 2, this.gameWidth + 4, this.gameHeight + 4, 0x000000);
    border.setStrokeStyle(4, 0x00ff41);

    this.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
    this.food = this.generateFood();
    this.score = 0;

    this.scoreText = this.add.text(20, 20, `Score: ${this.score}`, {
      fontSize: "20px",
      color: "#ffffff",
      fontFamily: "monospace"
    });

    this.walletText = this.add.text(width - 20, 20, `Wallet: ${this.playerWallet.substring(0, 8)}...`, {
      fontSize: "16px",
      color: "#00ff41",
      fontFamily: "monospace"
    }).setOrigin(1, 0);

    if (this.playerX) {
      this.xText = this.add.text(width - 20, 45, `X: @${this.playerX}`, {
        fontSize: "14px",
        color: "#1da1f2",
        fontFamily: "monospace"
      }).setOrigin(1, 0);
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    this.setupMobileControls();

    this.gameTimer = this.time.addEvent({
      delay: 150,
      callback: this.updateGame,
      callbackScope: this,
      loop: true
    });

    this.input.keyboard.on('keydown-ESC', () => {
      this.scene.start("MenuScene");
    });

    if (this.cache.audio.exists("biteSound")) {
      this.biteSound = this.sound.add("biteSound", { volume: 0.5 });
    } else {
      console.log("Bite sound not found");
      this.biteSound = null;
    }

    this.enableMobileAudio();
  }

  setupMobileControls() {
    const { width, height } = this.scale;
    const controlSize = 60;
    const controlY = height - 80;

    const upButton = this.add.circle(width / 2, controlY - 50, controlSize / 2, 0x333333, 0.7);
    upButton.setStrokeStyle(2, 0x00ff41);
    this.add.text(width / 2, controlY - 50, "↑", { fontSize: "24px", color: "#00ff41" }).setOrigin(0.5);

    const downButton = this.add.circle(width / 2, controlY + 50, controlSize / 2, 0x333333, 0.7);
    downButton.setStrokeStyle(2, 0x00ff41);
    this.add.text(width / 2, controlY + 50, "↓", { fontSize: "24px", color: "#00ff41" }).setOrigin(0.5);

    const leftButton = this.add.circle(width / 2 - 80, controlY, controlSize / 2, 0x333333, 0.7);
    leftButton.setStrokeStyle(2, 0x00ff41);
    this.add.text(width / 2 - 80, controlY, "←", { fontSize: "24px", color: "#00ff41" }).setOrigin(0.5);

    const rightButton = this.add.circle(width / 2 + 80, controlY, controlSize / 2, 0x333333, 0.7);
    rightButton.setStrokeStyle(2, 0x00ff41);
    this.add.text(width / 2 + 80, controlY, "→", { fontSize: "24px", color: "#00ff41" }).setOrigin(0.5);

    upButton.setInteractive().on('pointerdown', () => this.changeDirection(0, -1));
    downButton.setInteractive().on('pointerdown', () => this.changeDirection(0, 1));
    leftButton.setInteractive().on('pointerdown', () => this.changeDirection(-1, 0));
    rightButton.setInteractive().on('pointerdown', () => this.changeDirection(1, 0));

    this.input.on('pointerdown', pointer => {
      if (pointer.y < height * 0.7) {
        const centerX = width / 2;
        const centerY = height / 2;
        const dx = pointer.x - centerX;
        const dy = pointer.y - centerY;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.changeDirection(dx > 0 ? 1 : -1, 0);
        } else {
          this.changeDirection(0, dy > 0 ? 1 : -1);
        }
      }
    });
  }

  changeDirection(x, y) {
    if (this.direction.x !== -x || this.direction.y !== -y) {
      this.nextDirection = { x, y };
    }
  }

  update() {
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.changeDirection(-1, 0);
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.changeDirection(1, 0);
    } else if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.changeDirection(0, -1);
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.changeDirection(0, 1);
    }
  }

  updateGame() {
    this.direction = this.nextDirection;
    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    const maxX = Math.floor(this.gameWidth / this.gridSize);
    const maxY = Math.floor(this.gameHeight / this.gridSize);

    if (head.x < 0 || head.x >= maxX || head.y < 0 || head.y >= maxY) {
      this.gameOver();
      return;
    }

    for (let segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.gameOver();
        return;
      }
    }

    const ateFood = head.x === this.food.x && head.y === this.food.y;
    if (ateFood) {
      if (this.biteSound) {
        try {
          this.biteSound.play();
        } catch (error) {
          console.log("Could not play bite sound:", error);
        }
      }
      this.snake.unshift(head);
      this.score++;
      this.scoreText.setText(`Score: ${this.score}`);
      this.food = this.generateFood();
      this.createFoodParticles();
    } else {
      this.snake.unshift(head);
      this.snake.pop();
    }

    this.renderGame();
  }

  enableMobileAudio() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const enableAudio = () => {
        if (this.sound.context.state === 'suspended') {
          this.sound.context.resume();
        }
        document.removeEventListener('touchstart', enableAudio);
        document.removeEventListener('click', enableAudio);
      };
      document.addEventListener('touchstart', enableAudio);
      document.addEventListener('click', enableAudio);
    }
  }

  renderGame() {
    if (this.snakeSprites) {
      this.snakeSprites.forEach(sprite => sprite.destroy());
    }
    if (this.foodSprite) {
      this.foodSprite.destroy();
    }

    this.snakeSprites = [];
    this.snake.forEach((segment, index) => {
      const sprite = this.add.image(
        this.offsetX + segment.x * this.gridSize + this.gridSize / 2,
        this.offsetY + segment.y * this.gridSize + this.gridSize / 2,
        "snakeBody"
      );
      if (index === 0) {
        sprite.setTint(0x008000);
      }
      this.snakeSprites.push(sprite);
    });

    this.foodSprite = this.add.image(
      this.offsetX + this.food.x * this.gridSize + this.gridSize / 2,
      this.offsetY + this.food.y * this.gridSize + this.gridSize / 2,
      "food"
    );
  }

  generateFood() {
    const maxX = Math.floor(this.gameWidth / this.gridSize);
    const maxY = Math.floor(this.gameHeight / this.gridSize);
    let food;
    do {
      food = {
        x: Math.floor(Math.random() * maxX),
        y: Math.floor(Math.random() * maxY)
      };
    } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
    return food;
  }

  createFoodParticles() {
    const foodX = this.offsetX + this.food.x * this.gridSize + this.gridSize / 2;
    const foodY = this.offsetY + this.food.y * this.gridSize + this.gridSize / 2;
    const emitter = this.add.particles(foodX, foodY, "particle", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      lifespan: 300,
      tint: 0x00ff41,
      quantity: 10,
      emitting: false
    });
    emitter.explode(10);
    this.time.delayedCall(500, () => {
      emitter.destroy();
    });
  }

  async gameOver() {
    this.gameTimer.destroy();
    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const uniqueId = `${this.playerWallet}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const playerData = {
        id: uniqueId,
        wallet: this.playerWallet,
        xUsername: this.playerX || "",
        score: this.score,
        timestamp: Date.now(),
        date: mountainTime.toISOString().split('T')[0]
      };
      await client.createEntity('players', playerData);
    } catch (error) {
      console.error("Error saving score:", error);
    }
    this.scene.start("GameOverScene", {
      score: this.score,
      wallet: this.playerWallet,
      xUsername: this.playerX
    });
  }
}

class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  init(data) {
    this.finalScore = data.score;
    this.playerWallet = data.wallet;
    this.playerX = data.xUsername;
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.2, "GAME OVER", {
      fontSize: "48px",
      color: "#ff4444",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.35, `Final Score: ${this.finalScore}`, {
      fontSize: "32px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `Wallet: ${this.playerWallet.substring(0, 12)}...`, {
      fontSize: "16px",
      color: "#00ff41",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    if (this.playerX) {
      this.add.text(width / 2, height * 0.5, `X: @${this.playerX}`, {
        fontSize: "16px",
        color: "#1da1f2",
        fontFamily: "monospace"
      }).setOrigin(0.5);
    }

    const playAgainButton = this.add.rectangle(width / 2 - 100, height * 0.65, 180, 50, 0x00ff41);
    playAgainButton.setStrokeStyle(3, 0xffffff);
    this.add.text(width / 2 - 100, height * 0.65, "PLAY AGAIN", {
      fontSize: "16px",
      color: "#000000",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    const leaderboardButton = this.add.rectangle(width / 2 + 100, height * 0.65, 180, 50, 0x333333);
    leaderboardButton.setStrokeStyle(3, 0x00ff41);
    this.add.text(width / 2 + 100, height * 0.65, "LEADERBOARD", {
      fontSize: "16px",
      color: "#00ff41",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    const menuButton = this.add.rectangle(width / 2, height * 0.8, 150, 40, 0x666666);
    menuButton.setStrokeStyle(2, 0xffffff);
    this.add.text(width / 2, height * 0.8, "MAIN MENU", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    playAgainButton.setInteractive();
    playAgainButton.on('pointerdown', () => {
      this.scene.start("GameScene", {
        wallet: this.playerWallet,
        xUsername: this.playerX
      });
    });

    leaderboardButton.setInteractive();
    leaderboardButton.on('pointerdown', () => {
      this.scene.start("LeaderboardScene");
    });

    menuButton.setInteractive();
    menuButton.on('pointerdown', () => {
      this.scene.start("MenuScene");
    });
  }
}

class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: "LeaderboardScene" });
    this.currentView = "leaderboard";
  }

  async create() {
    const { width } = this.scale;

    this.leaderboardTab = this.add.rectangle(width / 2 - 100, 30, 180, 40, 0x00ff41);
    this.leaderboardTab.setStrokeStyle(2, 0xffffff);
    this.leaderboardTabText = this.add.text(width / 2 - 100, 30, "TODAY'S LEADERBOARD", {
      fontSize: "14px",
      color: "#000000",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.winnersTab = this.add.rectangle(width / 2 + 100, 30, 180, 40, 0x333333);
    this.winnersTab.setStrokeStyle(2, 0x888888);
    this.winnersTabText = this.add.text(width / 2 + 100, 30, "PAST WINNERS", {
      fontSize: "14px",
      color: "#888888",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    this.leaderboardTab.setInteractive();
    this.leaderboardTab.on('pointerdown', () => {
      this.currentView = "leaderboard";
      this.refreshView();
    });

    this.winnersTab.setInteractive();
    this.winnersTab.on('pointerdown', () => {
      this.currentView = "winners";
      this.refreshView();
    });

    this.contentText = this.add.text(width / 2, 90, "Loading...", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    await this.refreshView();
  }

  async refreshView() {
    const { width, height } = this.scale;

    if (this.currentView === "leaderboard") {
      this.leaderboardTab.setFillStyle(0x00ff41);
      this.leaderboardTab.setStrokeStyle(2, 0xffffff);
      this.leaderboardTabText.setColor("#000000");
      this.winnersTab.setFillStyle(0x333333);
      this.winnersTab.setStrokeStyle(2, 0x888888);
      this.winnersTabText.setColor("#888888");
    } else {
      this.leaderboardTab.setFillStyle(0x333333);
      this.leaderboardTab.setStrokeStyle(2, 0x888888);
      this.leaderboardTabText.setColor("#888888");
      this.winnersTab.setFillStyle(0x00ff41);
      this.winnersTab.setStrokeStyle(2, 0xffffff);
      this.winnersTabText.setColor("#000000");
    }

    if (this.backButton) {
      this.backButton.destroy();
      this.backButton = null;
    }
    if (this.backButtonText) {
      this.backButtonText.destroy();
      this.backButtonText = null;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }

    const childrenToKeep = [this.leaderboardTab, this.leaderboardTabText, this.winnersTab, this.winnersTabText];
    const allChildren = [...this.children.list];
    allChildren.forEach(child => {
      if (!childrenToKeep.includes(child)) {
        child.destroy();
      }
    });

    this.children.removeAll();
    this.children.add(this.leaderboardTab);
    this.children.add(this.leaderboardTabText);
    this.children.add(this.winnersTab);
    this.children.add(this.winnersTabText);

    if (this.currentView === "leaderboard") {
      await this.showLeaderboard();
    } else {
      await this.showPastWinners();
    }

    this.backButton = this.add.rectangle(width / 2, height - 60, 150, 40, 0x333333);
    this.backButton.setStrokeStyle(2, 0x00ff41);
    this.backButtonText = this.add.text(width / 2, height - 60, "BACK TO MENU", {
      fontSize: "16px",
      color: "#00ff41",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    this.backButton.setInteractive();
    this.backButton.on('pointerdown', () => {
      this.scene.start("MenuScene");
    });

    this.updateDailyTimer();
  }

  async showLeaderboard() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 70, "🏆 DAILY LEADERBOARD 🏆", {
      fontSize: "28px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const today = mountainTime.toISOString().split('T')[0];
      const todayPayments = await client.getEntities('daily_payments', { date: today });
      const totalCollected = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const dailyPot = totalCollected * 0.9;
      const todayScores = await client.getEntities('players', { date: today });
      todayScores.sort((a, b) => b.score - a.score);
      const top10 = todayScores.slice(0, 10);

      this.add.text(width / 2, 105, `💰 Daily Pot: ${dailyPot.toFixed(3)} SOL 💰`, {
        fontSize: "20px",
        color: "#00ff41",
        fontFamily: "monospace",
        fontWeight: "bold"
      }).setOrigin(0.5);

      if (top10.length === 0) {
        this.add.text(width / 2, height / 2, "No scores yet today!\nBe the first to play!", {
          fontSize: "24px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center"
        }).setOrigin(0.5);
      } else {
        top10.forEach((player, index) => {
          const y = 160 + index * 35;
          const rank = index + 1;
          const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
          const color = rank === 1 ? "#ffff00" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "#ffffff";
          let displayText = `${medal} ${player.wallet.substring(0, 8)}... - ${player.score}`;
          if (player.xUsername) {
            displayText += ` (@${player.xUsername})`;
          }
          const playerText = this.add.text(width / 2, y, displayText, {
            fontSize: "16px",
            color: color,
            fontFamily: "monospace"
          }).setOrigin(0.5);

          playerText.setInteractive({ useHandCursor: true });
          playerText.on('pointerdown', () => {
            navigator.clipboard.writeText(player.wallet).then(() => {
              const originalText = displayText;
              playerText.setText(displayText + " (Copied!)");
              this.time.delayedCall(2000, () => {
                playerText.setText(originalText);
              });
            }).catch(() => {
              console.error('Failed to copy wallet address');
            });
          });
        });

        if (top10[0]) {
          this.add.text(width / 2, height - 170, `🎯 Current Leader: ${top10[0].wallet.substring(0, 12)}...`, {
            fontSize: "18px",
            color: "#00ff41",
            fontFamily: "monospace"
          }).setOrigin(0.5);
          this.add.text(width / 2, height - 145, `Score to Beat: ${top10[0].score}`, {
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: "monospace"
          }).setOrigin(0.5);
          this.add.text(width / 2, height - 120, `Winner takes ${dailyPot.toFixed(3)} SOL!`, {
            fontSize: "16px",
            color: "#ffff00",
            fontFamily: "monospace",
            fontWeight: "bold"
          }).setOrigin(0.5);
        }
      }
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      this.add.text(width / 2, height / 2, "Error loading leaderboard", {
        fontSize: "18px",
        color: "#ff4444",
        fontFamily: "monospace"
      }).setOrigin(0.5);
    }
  }

  async showPastWinners() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 70, "🏆 PAST WINNERS 🏆", {
      fontSize: "28px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    try {
      const allWinners = await client.getEntities('daily_winners');
      const validWinners = allWinners.filter(winner => winner && winner.wallet && winner.score !== undefined);
      validWinners.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (validWinners.length === 0) {
        this.add.text(width / 2, height / 2, "No past winners yet!\nBe the first daily champion!", {
          fontSize: "24px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center"
        }).setOrigin(0.5);
      } else {
        this.add.text(width / 2, 105, `🎯 Total Champions: ${validWinners.length}`, {
          fontSize: "18px",
          color: "#00ff41",
          fontFamily: "monospace",
          fontWeight: "bold"
        }).setOrigin(0.5);

        const maxVisible = 8;
        const visibleWinners = validWinners.slice(0, maxVisible);
        visibleWinners.forEach((winner, index) => {
          const y = 140 + index * 55;
          const wallet = winner.wallet || "Unknown";
          const score = winner.score || 0;
          const date = winner.date ? new Date(winner.date + "T00:00:00").toLocaleDateString() : "Unknown Date";
          const dailyPot = winner.dailyPot || 0;
          const xUsername = winner.xUsername || "";

          const walletText = this.add.text(width / 2, y, `🥇 ${wallet}`, {
            fontSize: "14px",
            color: "#ffff00",
            fontFamily: "monospace",
            fontWeight: "bold"
          }).setOrigin(0.5);

          walletText.setInteractive({ useHandCursor: true });
          walletText.on('pointerdown', () => {
            navigator.clipboard.writeText(wallet).then(() => {
              walletText.setText(`🥇 ${wallet} (Copied!)`);
              this.time.delayedCall(2000, () => {
                walletText.setText(`🥇 ${wallet}`);
              });
            }).catch(() => {
              console.error('Failed to copy wallet address');
            });
          });

          if (xUsername) {
            this.add.text(width / 2, y + 18, `@${xUsername}`, {
              fontSize: "12px",
              color: "#1da1f2",
              fontFamily: "monospace"
            }).setOrigin(0.5);
          }

          const potText = dailyPot > 0 ? ` | Won: ${dailyPot.toFixed(3)} SOL` : " | Won: 0.000 SOL";
          this.add.text(width / 2, y + (xUsername ? 36 : 18), `Score: ${score} | ${date}${potText}`, {
            fontSize: "11px",
            color: "#ffffff",
            fontFamily: "monospace"
          }).setOrigin(0.5);
        });

        if (validWinners.length > maxVisible) {
          this.add.text(width / 2, 140 + maxVisible * 55, `... and ${validWinners.length - maxVisible} more champions!`, {
            fontSize: "14px",
            color: "#888888",
            fontFamily: "monospace",
            fontStyle: "italic"
          }).setOrigin(0.5);
        }
      }
    } catch (error) {
      console.error("Error loading past winners:", error);
      this.add.text(width / 2, height / 2, "Error loading past winners", {
        fontSize: "18px",
        color: "#ff4444",
        fontFamily: "monospace"
      }).setOrigin(0.5);
    }
  }

  updateDailyTimer() {
    const now = new Date();
    const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
    const tomorrow = new Date(mountainTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeLeft = tomorrow - mountainTime;
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor(timeLeft % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(timeLeft % (1000 * 60) / 1000);

    if (mountainTime.getHours() === 0 && mountainTime.getMinutes() === 0 && mountainTime.getSeconds() < 2) {
      this.handleDailyReset();
    }

    if (this.timerText) {
      this.timerText.destroy();
    }

    this.timerText = this.add.text(this.scale.width / 2, this.scale.height - 30, `Daily Reset: ${hours}h ${minutes}m ${seconds}s`, {
      fontSize: "14px",
      color: "#ffff00",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    this.time.delayedCall(1000, () => this.updateDailyTimer());
  }

  async handleDailyReset() {
    try {
      const now = new Date();
      const mountainTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Denver" }));
      const yesterday = new Date(mountainTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const existingWinner = await client.getEntity('daily_winners', `winner_${yesterdayStr}`);
      const yesterdayScores = await client.getEntities('players', { date: yesterdayStr });

      if (yesterdayScores.length > 0) {
        yesterdayScores.sort((a, b) => b.score - a.score);
        const actualWinner = yesterdayScores[0];
        let dailyPot = 0;
        try {
          const yesterdayPayments = await client.getEntities('daily_payments', { date: yesterdayStr });
          const totalCollected = yesterdayPayments.reduce((sum, payment) => sum + payment.amount, 0);
          dailyPot = totalCollected * 0.9;
        } catch (error) {
          console.error("Error calculating daily pot:", error);
        }

        const winnerData = {
          wallet: actualWinner.wallet || "Unknown",
          xUsername: actualWinner.xUsername || "",
          score: actualWinner.score || 0,
          date: yesterdayStr,
          timestamp: Date.now(),
          dailyPot: dailyPot || 0
        };

        if (existingWinner) {
          console.log(`Updating past winner for ${yesterdayStr}: score ${winnerData.score}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.updateEntity('daily_winners', `winner_${yesterdayStr}`, winnerData);
        } else {
          console.log(`Creating new past winner for ${yesterdayStr}: score ${winnerData.score}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.createEntity('daily_winners', {
            id: `winner_${yesterdayStr}`,
            ...winnerData
          });
        }
      }
    } catch (error) {
      console.error("Error handling daily reset:", error);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: "app",
    width: window.innerWidth,
    height: window.innerHeight
  },
  backgroundColor: "#1A1A28",
  scene: [BootScene, MenuScene, GameScene, GameOverScene, LeaderboardScene]
};

export const game = new Phaser.Game(config);