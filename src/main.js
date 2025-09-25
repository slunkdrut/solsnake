import * as Phaser from "phaser";
import { StateClient } from './mockStateClient.js';

// Env-configured values with sensible fallbacks
const RECEIVING_WALLET = (import.meta?.env?.VITE_RECEIVING_WALLET) || "5pLqMhYx9zmsdCAsRRcTMtEahFzGvQAfs2CzPfeTF14L";
const RPC_URL = (import.meta?.env?.VITE_SOL_RPC) || "https://autumn-cool-research.solana-mainnet.quiknode.pro/d0e8d80ee0f8b5f35291b9261dab71e9afc9d607/";

// Server-time helpers (fallback to client time if API unavailable)
let TIME_CONFIG_CACHE = null;
async function getTimeConfig() {
  if (TIME_CONFIG_CACHE) return TIME_CONFIG_CACHE;
  try {
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (!res.ok) throw new Error('Time API not available');
    TIME_CONFIG_CACHE = await res.json();
  } catch (e) {
    TIME_CONFIG_CACHE = null;
  }
  return TIME_CONFIG_CACHE;
}

// Robust clipboard copy helper with fallback for older browsers
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(resolve).catch(() => {
        // Fallback if permissions/API blocked
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('copy failed'));
        } catch (e) {
          reject(e);
        }
      });
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
    }
  });
}

// Create a yyyy-mm-dd date key relative to America/Denver timezone
function toMountainDateKey(ms) {
  const local = new Date(new Date(ms).toLocaleString("en-US", { timeZone: "America/Denver" }));
  return local.toISOString().split('T')[0];
}

async function getPeriodData() {
  // Compute 24h periods that start at 1:00 PM in America/Denver (Mountain Time), DST-aware
  const nowMs = Date.now();
  const mountainNow = new Date(new Date(nowMs).toLocaleString("en-US", { timeZone: "America/Denver" }));
  const startLocal = new Date(mountainNow);
  startLocal.setHours(20, 0, 0, 0); // 8 PM MT today
  if (mountainNow < startLocal) {
    // If before today's 1 PM MT, use yesterday's 1 PM MT
    startLocal.setDate(startLocal.getDate() - 1);
  }
  const startMs = startLocal.getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const msLeft = Math.max(0, endMs - nowMs);
  const todayKey = toMountainDateKey(startMs);
  const yesterdayKey = toMountainDateKey(startMs - 24 * 60 * 60 * 1000);
  return { nowMs, epochMs: null, periodMs: 24 * 60 * 60 * 1000, index: null, startMs, endMs, msLeft, todayKey, yesterdayKey };
}
function toFiniteNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const STATE_API_BASE_URL = (import.meta?.env?.VITE_STATE_API_BASE_URL || '').trim();

const client = new StateClient({
  baseURL: STATE_API_BASE_URL || undefined,
  apiBaseURL: STATE_API_BASE_URL || undefined,
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
    this.receivingWallet = RECEIVING_WALLET;
    const isMobile = width < 800;
    const isActualMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isPhantomBrowser = window.solana && window.solana.isPhantom;

    // Compact vertical layout using dynamic bounds to avoid overlap
    // Increased gaps for clearer spacing
    const gapSm = isMobile ? 14 : 18;
    const gapMd = isMobile ? 22 : 28;
    const gapLg = isMobile ? 28 : 36;
    let y = isMobile ? Math.round(height * 0.08) : Math.round(height * 0.12);
    const nextY = (display, gap) => Math.round(display.getBounds().bottom + gap);

    // Title
    const title = this.add.text(width / 2, y, "SOLSNAKE", {
      fontSize: isMobile ? "22px" : "34px",
      color: "#00ff41",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(width / 2, nextY(title, gapLg), "🐍 The Most Degenerate Snake Game in Crypto! 🐍", {
      fontSize: isMobile ? "13px" : "18px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    // Daily prize
    this.dailyPrizeText = this.add.text(width / 2, nextY(subtitle, gapMd), "Daily Prize: 0.000 SOL", {
      fontSize: isMobile ? "14px" : "16px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    // Connect wallet button
    y = nextY(this.dailyPrizeText, gapMd);
    this.connectWalletButton = this.add.rectangle(width / 2, y, isMobile ? 280 : 300, isMobile ? 40 : 50, 0x8a2be2);
    this.connectWalletButton.setStrokeStyle(3, 0xffffff);
    let connectText = "CONNECT PHANTOM WALLET";
    if (isActualMobile) {
      connectText = isPhantomBrowser ? "CONNECT WALLET" : "OPEN IN PHANTOM BROWSER";
    }
    this.connectWalletText = this.add.text(width / 2, y, connectText, {
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

    this.walletStatusText = this.add.text(width / 2, nextY(this.connectWalletButton, gapSm), isActualMobile && !isPhantomBrowser ? "For best experience, use Phantom browser" : "Connect wallet to continue", {
      fontSize: isMobile ? "10px" : "14px",
      color: "#888888",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    // Payment section
    this.paymentStatusText = this.add.text(width / 2, nextY(this.walletStatusText, gapLg), "💰 PAYMENT REQUIRED 💰", {
      fontSize: isMobile ? "14px" : "20px",
      color: "#ffff00",
      fontFamily: "monospace",
      fontWeight: "bold"
    }).setOrigin(0.5);

    const costText = this.add.text(width / 2, nextY(this.paymentStatusText, gapSm), "Cost: 0.01 SOL daily pass - play unlimited games", {
      fontSize: isMobile ? "10px" : "14px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    y = nextY(costText, gapMd);
    this.paymentButton = this.add.rectangle(width / 2, y, isMobile ? 220 : 250, isMobile ? 40 : 50, 0x666666);
    this.paymentButton.setStrokeStyle(3, 0x888888);
    this.paymentButtonText = this.add.text(width / 2, y, "PAY 0.01 SOL", {
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
    const xLabel = this.add.text(width / 2, nextY(this.paymentButton, gapLg), "X.com username (optional):", {
      fontSize: isMobile ? "12px" : "16px",
      color: "#ffffff",
      fontFamily: "monospace"
    }).setOrigin(0.5);

    const xInputBg = this.add.rectangle(width / 2, nextY(xLabel, gapMd), isMobile ? 260 : 300, isMobile ? 30 : 40, 0x333333);
    xInputBg.setStrokeStyle(2, 0x1da1f2);
    this.xText = this.add.text(width / 2, xInputBg.y, "Click to enter X username", {
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
    y = nextY(xInputBg, gapLg);
    this.playButton = this.add.rectangle(width / 2, y, isMobile ? 180 : 200, isMobile ? 40 : 50, 0x666666);
    this.playButton.setStrokeStyle(3, 0x888888);
    this.playButtonText = this.add.text(width / 2, y, "PLAY", {
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
    y = nextY(this.playButton, gapMd);
    const leaderboardButton = this.add.rectangle(width / 2, y, isMobile ? 180 : 200, isMobile ? 34 : 40, 0x333333);
    leaderboardButton.setStrokeStyle(2, 0x00ff41);
    this.leaderboardText = this.add.text(width / 2, y, "LEADERBOARD", {
      fontSize: isMobile ? "13px" : "16px",
      color: "#00ff41",
      fontFamily: "monospace"
    }).setOrigin(0.5);
    leaderboardButton.setInteractive();
    leaderboardButton.on('pointerdown', () => {
      this.scene.start("LeaderboardScene");
    });

    // Push X username, Play, Leaderboard cluster down a bit to better fill tall phones
    const lowerPush = isMobile ? Math.round(height * 0.08) : Math.round(height * 0.05);
    [xLabel, xInputBg, this.xText, this.playButton, this.playButtonText, leaderboardButton, this.leaderboardText]
      .forEach(el => { if (el && typeof el.y === 'number') el.y += lowerPush; });

    // Pull the section above the X username slightly closer to the title
    // (do not move the X username box, Play, or Leaderboard)
    const pullUp = isMobile ? 12 : 16;
    [subtitle, this.dailyPrizeText, this.connectWalletButton, this.connectWalletText,
     this.walletStatusText, this.paymentStatusText, costText,
     this.paymentButton, this.paymentButtonText].forEach(el => {
      if (el && typeof el.y === 'number') el.y -= pullUp;
    });

    // Removed disclaimer and description text per request

    this.updateDailyTimer();
    if (!isActualMobile) {
      this.checkPhantomWallet();
    }
    this.time.delayedCall(100, () => {
      this.updateDailyPrize();
    });
  }

  async updateDailyPrize() {
    try {
      const { todayKey } = await getPeriodData();
      const todayPayments = await client.getEntities('daily_payments', { date: todayKey });
      const totalCollected = todayPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
      const dailyPrize = toFiniteNumber(totalCollected * 0.9);
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
      const loadScript = (src) => new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res();
        s.onerror = () => rej(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });
      (async () => {
        try {
          // Ensure Buffer exists (required by solana web3 bundle in browsers)
          if (!window.Buffer) {
            await loadScript('https://cdn.jsdelivr.net/npm/buffer@6.0.3/index.min.js');
            if (window.buffer && window.buffer.Buffer && !window.Buffer) {
              window.Buffer = window.buffer.Buffer;
            }
            // On some mobile browsers the iife exposes helpers on window.buffer but not on Buffer
            // Make sure the common constructors are available
            if (window.buffer && (!window.Buffer || !window.Buffer.from)) {
              const buf = window.buffer.Buffer || window.Buffer;
              if (buf) {
                window.Buffer = buf;
                if (!buf.from && window.buffer.from) buf.from = window.buffer.from;
                if (!buf.alloc && window.buffer.alloc) buf.alloc = window.buffer.alloc;
                if (!buf.allocUnsafe && window.buffer.allocUnsafe) buf.allocUnsafe = window.buffer.allocUnsafe;
                if (!buf.concat && window.buffer.concat) buf.concat = window.buffer.concat;
              }
            }
            if (!window.Buffer) throw new Error('Buffer polyfill failed to load');
            if (!window.global) window.global = window; // some libs expect global
            if (!globalThis.Buffer) globalThis.Buffer = window.Buffer;
            // Some packages expect a minimal process global
            if (!window.process) window.process = { env: {} };
            if (!globalThis.process) globalThis.process = window.process;
          }
          await loadScript('https://unpkg.com/@solana/web3.js@1.78.0/lib/index.iife.min.js');
          if (!window.solanaWeb3) throw new Error('Solana Web3 not available after load');
          this.solanaLoaded = true;
          resolve();
        } catch (e) {
          reject(e);
        }
      })();
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
      const { todayKey } = await getPeriodData();
      const paymentId = `${this.walletAddress}_${todayKey}`;
      
      // Clear old payment cache if it's from a different day
      const lastPaymentDate = localStorage.getItem('lastPaymentDate');
      if (lastPaymentDate && lastPaymentDate !== todayKey) {
        // Clear all payment cache for old dates
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('payment_') && !key.includes(todayKey)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem('lastPaymentDate', todayKey);
      }
      
      // First check localStorage for cached payment status
      const cachedPayment = localStorage.getItem(`payment_${paymentId}`);
      if (cachedPayment) {
        const paymentData = JSON.parse(cachedPayment);
        if (paymentData.confirmed && paymentData.date === todayKey) {
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
        localStorage.setItem('lastPaymentDate', todayKey);
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
    // Position GOOD LUCK just above the X username label
    // Slightly closer for a tighter grouping under payment
    const belowPayment = (this.paymentButton?.y || 0) + (isMobile ? 44 : 52);
    this.goodLuckText = this.add.text(width / 2, belowPayment, "GOOD LUCK!", {
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
      const connection = new window.solanaWeb3.Connection(RPC_URL, 'confirmed');
      const solAmount = 0.01;
      const lamportsPerSol = 1_000_000_000;
      const lamportsAmount = Math.round(solAmount * lamportsPerSol);
      console.log("Lamports amount:", lamportsAmount, "Type:", typeof lamportsAmount);

      // Build and send a standard SystemProgram.transfer transaction via Phantom
      const fromPubkey = new window.solanaWeb3.PublicKey(this.walletAddress);
      const toPubkey = new window.solanaWeb3.PublicKey(this.receivingWallet);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      console.log("Got blockhash:", blockhash);
      const transaction = new window.solanaWeb3.Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey
      });
      transaction.add(window.solanaWeb3.SystemProgram.transfer({ fromPubkey, toPubkey, lamports: lamportsAmount }));
      console.log("Transaction created, requesting signature...");
      const sent = await this.phantom.signAndSendTransaction(transaction, { commitment: 'confirmed' });
      const signature = sent.signature;
      this.paymentButtonText.setText("CONFIRMING...");
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      console.log("Transaction confirmed");
      const { todayKey } = await getPeriodData();
      const paymentId = `${this.walletAddress}_${todayKey}`;
      const paymentData = {
        id: paymentId,
        wallet: this.walletAddress,
        amount: 0.01,
        date: todayKey,
        signature: signature,
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
      alert(`✅ Payment successful!\n\n0.01 SOL sent to: ${this.receivingWallet}\n\nTransaction ID: ${signature}\n\nYou now have unlimited plays until daily reset!`);
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
    (async () => {
      const { msLeft } = await getPeriodData();
      const isMobile = this.scale.width < 800;
      const hours = Math.floor(msLeft / (1000 * 60 * 60));
      const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((msLeft % (1000 * 60)) / 1000);
      if (msLeft <= 2000) {
        this.time.delayedCall(100, () => {
          this.handleDailyReset();
        });
      }
      if (this.timerText) {
        this.timerText.destroy();
      }
      const bottomMargin = isMobile ? 14 : 18;
      const y = this.scale.height - bottomMargin;
      this.timerText = this.add.text(this.scale.width / 2, y, `Daily Reset: ${hours}h ${minutes}m ${seconds}s`, {
        fontSize: isMobile ? "12px" : "14px",
        color: "#ffff00",
        fontFamily: "monospace"
      }).setOrigin(0.5);
      this.time.delayedCall(1000, () => this.updateDailyTimer());
    })();
  }

  async handleDailyReset() {
    try {
      const { yesterdayKey } = await getPeriodData();
      if (this._lastResetKey === yesterdayKey) {
        return;
      }
      const yesterdayScoresRaw = await client.getEntities('players', { date: yesterdayKey });
      if (yesterdayScoresRaw.length > 0) {
        // Determine top score and all unique wallets with that score
        const yesterdayScores = yesterdayScoresRaw.map(entry => ({ ...entry, score: toFiniteNumber(entry.score) }))
          .sort((a, b) => b.score - a.score);
        const topEntry = yesterdayScores[0];
        const topScore = topEntry.score;
        const topWallet = topEntry.wallet || "Anonymous";
        const topUsername = topEntry.xUsername || "";

        // Calculate pot for the day
        let dailyPot = 0;
        try {
          const yesterdayPayments = await client.getEntities('daily_payments', { date: yesterdayKey });
          const totalCollected = yesterdayPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
          dailyPot = toFiniteNumber(totalCollected * 0.9);
        } catch (error) {
          console.error("Error calculating daily pot:", error);
        }

        const timestamp = Date.now();
        const winnerId = `winner_${yesterdayKey}_${topWallet}`;
        const payload = {
          wallet: topWallet,
          xUsername: topUsername,
          score: topScore,
          date: yesterdayKey,
          timestamp,
          dailyPot: dailyPot || 0
        };
        const existing = await client.getEntity('daily_winners', winnerId);
        if (existing) {
          console.log(`Updating past winner ${topWallet} for ${yesterdayKey}: score ${topScore}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.updateEntity('daily_winners', winnerId, payload);
        } else {
          console.log(`Creating past winner ${topWallet} for ${yesterdayKey}: score ${topScore}, pot ${dailyPot.toFixed(3)} SOL`);
          await client.createEntity('daily_winners', { id: winnerId, ...payload });
        }

        const legacyId = `winner_${yesterdayKey}`;
        const legacyPayload = {
          wallet: topWallet,
          xUsername: topUsername,
          score: topScore,
          date: yesterdayKey,
          timestamp,
          dailyPot: dailyPot || 0
        };
        const existingLegacy = await client.getEntity('daily_winners', legacyId);
        if (existingLegacy) {
          await client.updateEntity('daily_winners', legacyId, legacyPayload);
        } else {
          await client.createEntity('daily_winners', { id: legacyId, ...legacyPayload });
        }

        try {
          const existingForDate = await client.getEntities('daily_winners', { date: yesterdayKey });
          const keep = new Set([winnerId, legacyId]);
          for (const entry of existingForDate) {
            if (entry?.id && !keep.has(entry.id)) {
              await client.deleteEntity('daily_winners', entry.id);
            }
          }
        } catch (cleanupError) {
          console.warn('Failed to prune stale winners', cleanupError);
        }
        try {
          // Clear yesterday's leaderboard entries so only past winners retain addresses
          const entriesToDelete = yesterdayScores.filter(entry => entry?.id);
          if (entriesToDelete.length > 0) {
            const results = await Promise.allSettled(
              entriesToDelete.map(entry => client.deleteEntity('players', entry.id))
            );
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                const failed = entriesToDelete[index];
                console.warn(`Failed to remove player entry ${failed?.id} for ${yesterdayKey}`, result.reason);
              }
            });
          }
        } catch (pruneError) {
          console.warn('Failed to clear daily leaderboard entries for rollover', pruneError);
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

    // Initialize sprite pools
    this.snakeSprites = [];
    for (let i = 0; i < this.snake.length; i++) {
      const segment = this.snake[i];
      const sprite = this.add.image(
        this.offsetX + segment.x * this.gridSize + this.gridSize / 2,
        this.offsetY + segment.y * this.gridSize + this.gridSize / 2,
        "snakeBody"
      );
      if (i === 0) sprite.setTint(0x008000);
      this.snakeSprites.push(sprite);
    }
    this.foodSprite = this.add.image(
      this.offsetX + this.food.x * this.gridSize + this.gridSize / 2,
      this.offsetY + this.food.y * this.gridSize + this.gridSize / 2,
      "food"
    );
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
      // Create a new sprite for the new head if needed
      if (this.snakeSprites.length < this.snake.length) {
        const newSprite = this.add.image(0, 0, "snakeBody");
        this.snakeSprites.unshift(newSprite);
      } else {
        // Maintain array alignment when unshifting
        const recycled = this.snakeSprites.pop();
        this.snakeSprites.unshift(recycled);
      }
    } else {
      this.snake.unshift(head);
      this.snake.pop();
      // Reuse tail sprite as new head sprite
      const tailSprite = this.snakeSprites.pop();
      this.snakeSprites.unshift(tailSprite);
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
    // Update snake sprites positions instead of recreating each frame
    for (let i = 0; i < this.snake.length; i++) {
      const segment = this.snake[i];
      let sprite = this.snakeSprites[i];
      if (!sprite) {
        sprite = this.add.image(0, 0, "snakeBody");
        this.snakeSprites[i] = sprite;
      }
      sprite.setPosition(
        this.offsetX + segment.x * this.gridSize + this.gridSize / 2,
        this.offsetY + segment.y * this.gridSize + this.gridSize / 2
      );
      if (i === 0) {
        sprite.setTint(0x008000);
      } else {
        sprite.clearTint();
      }
    }
    // Update food sprite position
    if (!this.foodSprite) {
      this.foodSprite = this.add.image(0, 0, "food");
    }
    this.foodSprite.setPosition(
      this.offsetX + this.food.x * this.gridSize + this.gridSize / 2,
      this.offsetY + this.food.y * this.gridSize + this.gridSize / 2
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
      const { todayKey } = await getPeriodData();
      const uniqueId = `${this.playerWallet}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const playerData = {
        id: uniqueId,
        wallet: this.playerWallet,
        xUsername: this.playerX || "",
        score: this.score,
        timestamp: Date.now(),
        date: todayKey
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
    this._lastResetKey = null;
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
    await this.ensurePreviousDayWinner();
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
      const { todayKey } = await getPeriodData();
      const todayPayments = await client.getEntities('daily_payments', { date: todayKey });
      const totalCollected = todayPayments.reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
      const dailyPot = toFiniteNumber(totalCollected * 0.9);
      const todayScores = await client.getEntities('players', { date: todayKey });
      const sortedScores = todayScores
        .map(entry => ({ ...entry, score: toFiniteNumber(entry.score) }))
        .sort((a, b) => b.score - a.score);
      // Show raw top scores (duplicates per wallet allowed)
      const top = sortedScores.slice(0, 5);

      this.add.text(width / 2, 105, `💰 Daily Pot: ${dailyPot.toFixed(3)} SOL 💰`, {
        fontSize: "20px",
        color: "#00ff41",
        fontFamily: "monospace",
        fontWeight: "bold"
      }).setOrigin(0.5);

      if (top.length === 0) {
        this.add.text(width / 2, height / 2, "No scores yet today!\nBe the first to play!", {
          fontSize: "24px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center"
        }).setOrigin(0.5);
      } else {
        top.forEach((player, index) => {
          const y = 160 + index * 35;
          const rank = index + 1;
          const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
          const color = rank === 1 ? "#ffff00" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "#ffffff";
          const scoreValue = player.score;
          let displayText = `${medal} ${player.wallet.substring(0, 8)}... - ${scoreValue}`;
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
            copyToClipboard(player.wallet).then(() => {
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

        if (top[0]) {
          this.add.text(width / 2, height - 220, `🎯 Current Leader: ${top[0].wallet.substring(0, 12)}...`, {
            fontSize: "18px",
            color: "#00ff41",
            fontFamily: "monospace"
          }).setOrigin(0.5);
          this.add.text(width / 2, height - 195, `Score to Beat: ${top[0].score}`, {
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: "monospace"
          }).setOrigin(0.5);
          this.add.text(width / 2, height - 170, `Winner takes ${dailyPot.toFixed(3)} SOL!`, {
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
      const validWinners = allWinners
        .filter(w => w && w.wallet && w.score !== undefined && w.date)
        .map(w => ({ ...w, score: toFiniteNumber(w.score), dailyPot: toFiniteNumber(w.dailyPot) }));

      if (validWinners.length === 0) {
        this.add.text(width / 2, height / 2, "No past winners yet!\nBe the first daily champion!", {
          fontSize: "24px",
          color: "#ffffff",
          fontFamily: "monospace",
          align: "center"
        }).setOrigin(0.5);
      } else {
        // Group by date, then show all top wallets for each date
        const byDate = new Map();
        for (const w of validWinners) {
          if (!byDate.has(w.date)) byDate.set(w.date, []);
          byDate.get(w.date).push(w);
        }
        // Sort groups by date desc
        const groups = Array.from(byDate.entries()).sort((a, b) => {
          // compare by date string (ISO yyyy-mm-dd) desc
          return a[0] < b[0] ? 1 : (a[0] > b[0] ? -1 : 0);
        });

        const maxGroups = 6;
        const visibleGroups = groups.slice(0, maxGroups);
        this.add.text(width / 2, 105, `🎯 Days Shown: ${visibleGroups.length}`, {
          fontSize: "18px",
          color: "#00ff41",
          fontFamily: "monospace",
          fontWeight: "bold"
        }).setOrigin(0.5);

        let y = 140;
        const lineGap = 18;
        for (const [dateKey, entries] of visibleGroups) {
          // Determine the top score for this date and only show winners matching that score
          const sortedEntries = [...entries].sort((a, b) => b.score - a.score);
          const topScore = sortedEntries[0]?.score || 0;
          const winners = sortedEntries.filter(e => e.score === topScore);
          // Deduplicate wallets in case of mixed legacy entries
          const uniq = new Map();
          for (const w of winners) {
            if (!uniq.has(w.wallet)) uniq.set(w.wallet, w);
          }
          const winnersList = Array.from(uniq.values());
          const totalPot = toFiniteNumber(winnersList[0]?.dailyPot ?? sortedEntries[0]?.dailyPot ?? 0);
          const dateStr = new Date(dateKey + "T00:00:00").toLocaleDateString();

          // Group header
          this.add.text(width / 2, y, `${dateStr} | Top Score: ${topScore} | Pot: ${totalPot.toFixed(3)} SOL | Winners: ${winnersList.length}`, {
            fontSize: "13px",
            color: "#ffffff",
            fontFamily: "monospace",
            fontStyle: "italic"
          }).setOrigin(0.5);
          y += lineGap;

          // Winners for the day
          for (const w of winnersList) {
            const wallet = w.wallet || "Unknown";
            const xUsername = w.xUsername || "";
            const walletText = this.add.text(width / 2, y, `🥇 ${wallet}`, {
              fontSize: "14px",
              color: "#ffff00",
              fontFamily: "monospace",
              fontWeight: "bold"
            }).setOrigin(0.5);

            walletText.setInteractive({ useHandCursor: true });
            walletText.on('pointerdown', () => {
              copyToClipboard(wallet).then(() => {
                walletText.setText(`🥇 ${wallet} (Copied!)`);
                this.time.delayedCall(2000, () => walletText.setText(`🥇 ${wallet}`));
              }).catch(() => {
                console.error('Failed to copy wallet address');
              });
            });
            y += lineGap;
            if (xUsername) {
              this.add.text(width / 2, y, `@${xUsername}`, {
                fontSize: "12px",
                color: "#1da1f2",
                fontFamily: "monospace"
              }).setOrigin(0.5);
              y += lineGap;
            }
            // No per-winner split displayed; prize is sent manually
          }

          // Extra space between date groups
          y += 8;
        }

        if (groups.length > maxGroups) {
          this.add.text(width / 2, y + 10, `... and ${groups.length - maxGroups} more days!`, {
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
    (async () => {
      const { msLeft } = await getPeriodData();
      const hours = Math.floor(msLeft / (1000 * 60 * 60));
      const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((msLeft % (1000 * 60)) / 1000);

      if (msLeft <= 2000) {
        this.handleDailyReset();
      }

      if (this.timerText) {
        this.timerText.destroy();
      }

      const isMobile = this.scale.width < 800;
      const bottomMargin = isMobile ? 20 : 24; // keep timer below back button
      this.timerText = this.add.text(this.scale.width / 2, this.scale.height - bottomMargin, `Daily Reset: ${hours}h ${minutes}m ${seconds}s`, {
        fontSize: "14px",
        color: "#ffff00",
        fontFamily: "monospace"
      }).setOrigin(0.5);

      this.time.delayedCall(1000, () => this.updateDailyTimer());
    })();
  }

  async handleDailyReset() {
    try {
      const { yesterdayKey } = await getPeriodData();
      if (this._lastResetKey === yesterdayKey) {
        return;
      }
      await this.persistWinnerForDate(yesterdayKey);
      try { await this.refreshView(); } catch (_) {}
      this._lastResetKey = yesterdayKey;
    } catch (error) {
      console.error("Error handling daily reset:", error);
    }
  }

  async ensurePreviousDayWinner() {
    try {
      const { yesterdayKey } = await getPeriodData();
      if (!yesterdayKey) return;
      const existing = await client.getEntity('daily_winners', `winner_${yesterdayKey}`);
      if (!existing) {
        await this.persistWinnerForDate(yesterdayKey);
        this._lastResetKey = yesterdayKey;
        try { await this.refreshView(); } catch (_) {}
      }
    } catch (error) {
      console.error('Error ensuring previous winner:', error);
    }
  }

  async persistWinnerForDate(dateKey) {
    if (!dateKey) return;
    const scoresRaw = await client.getEntities('players', { date: dateKey });
    if (!scoresRaw || scoresRaw.length === 0) return;

    const sortedScores = scoresRaw.map(entry => ({ ...entry, score: toFiniteNumber(entry.score) }))
      .sort((a, b) => b.score - a.score);
    const topEntry = sortedScores[0];
    const topWallet = topEntry.wallet || 'Anonymous';
    const topUsername = topEntry.xUsername || '';
    const topScore = toFiniteNumber(topEntry.score);

    let dailyPot = 0;
    try {
      const payments = await client.getEntities('daily_payments', { date: dateKey });
      const totalCollected = payments.reduce((sum, payment) => sum + toFiniteNumber(payment.amount), 0);
      dailyPot = toFiniteNumber(totalCollected * 0.9);
    } catch (error) {
      console.error('Error calculating daily pot:', error);
    }

    const timestamp = Date.now();
    const winnerId = `winner_${dateKey}_${topWallet}`;
    const payload = {
      wallet: topWallet,
      xUsername: topUsername,
      score: topScore,
      date: dateKey,
      timestamp,
      dailyPot: dailyPot || 0
    };
    const existingWinner = await client.getEntity('daily_winners', winnerId);
    if (existingWinner) {
      await client.updateEntity('daily_winners', winnerId, payload);
    } else {
      await client.createEntity('daily_winners', { id: winnerId, ...payload });
    }

    const legacyId = `winner_${dateKey}`;
    const legacyPayload = { ...payload, id: legacyId };
    const existingLegacy = await client.getEntity('daily_winners', legacyId);
    if (existingLegacy) {
      await client.updateEntity('daily_winners', legacyId, legacyPayload);
    } else {
      await client.createEntity('daily_winners', legacyPayload);
    }

    try {
      // Clear the completed day's leaderboard entries so only past winners retain addresses
      const entriesToDelete = sortedScores.filter(entry => entry?.id);
      if (entriesToDelete.length > 0) {
        const results = await Promise.allSettled(
          entriesToDelete.map(entry => client.deleteEntity('players', entry.id))
        );
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const failed = entriesToDelete[index];
            console.warn(`Failed to remove player entry ${failed?.id} for ${dateKey}`, result.reason);
          }
        });
      }
    } catch (pruneError) {
      console.warn('Failed to clear daily leaderboard entries for rollover', pruneError);
    }
  }
}

const config = {
  type: Phaser.AUTO,
  scale: {
    // Fill the parent container and resize with the viewport
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: "app",
    width: 720,
    height: 1280
  },
  backgroundColor: "#1A1A28",
  scene: [BootScene, MenuScene, GameScene, GameOverScene, LeaderboardScene]
};

export const game = new Phaser.Game(config);

// Adjust game base size when orientation changes so it stays tall on phones
function updateGameOrientation() {
  const targetW = Math.max(320, Math.floor(window.innerWidth));
  const targetH = Math.max(480, Math.floor(window.innerHeight));
  if (game.scale.gameSize.width !== targetW || game.scale.gameSize.height !== targetH) {
    game.scale.setGameSize(targetW, targetH);
  }
}

window.addEventListener('resize', updateGameOrientation);
window.addEventListener('orientationchange', updateGameOrientation);
// Run once after boot
setTimeout(updateGameOrientation, 0);

