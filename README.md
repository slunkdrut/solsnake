# 🐍 Solana Snake Game

A complete Snake game built with Phaser.js that integrates with Solana blockchain for payments and leaderboards.

![Game Preview](https://img.shields.io/badge/Game-Snake-green)
![Phaser](https://img.shields.io/badge/Phaser-3.70.0-blue)
![Solana](https://img.shields.io/badge/Solana-Blockchain-purple)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🎮 Game Features

- **Classic Snake Gameplay** - Eat food, grow longer, avoid collisions
- **Solana Wallet Integration** - Connect with Phantom wallet
- **Mobile-Friendly Controls** - Touch controls for mobile devices
- **Daily Payment System** - Pay 0.01 SOL for unlimited daily plays
- **Leaderboard System** - Compete for daily prizes
- **Audio Support** - Background music and sound effects
- **Responsive Design** - Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Phantom wallet browser extension (optional for demo)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/solana-snake-game.git
   cd solana-snake-game
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser and go to:** `http://localhost:3000`

## ⚙️ Configuration

- Create a `.env` file (see `.env.example`) to configure:
  - `VITE_RECEIVING_WALLET` – wallet address that receives payments
  - `VITE_SOL_RPC` – Solana RPC URL used for payment confirmations
  - `VITE_USE_API_STORAGE` – optional flag; set to `1` to force the shared Vercel KV API, `0` to stay local-only. When omitted, the app auto-uses the shared API on non-local hosts.

Example:
```
VITE_RECEIVING_WALLET=YourWalletAddressHere
VITE_SOL_RPC=https://api.mainnet-beta.solana.com
```

Server time for daily reset and prizes comes from `GET /api/time` when deployed (Vercel). During local dev, if the API is unavailable, the game falls back to client Mountain Time (America/Denver) for daily boundaries.

### Persistent scores on Vercel

This project includes an API (`/api/state`) that can save scores and winners to Vercel KV (Upstash Redis). To enable:

1. In Vercel Project Settings → Environment Variables add:
   - `KV_REST_API_URL` (from your Upstash Redis)
   - `KV_REST_API_TOKEN` (from your Upstash Redis)
   - (optional) `VITE_USE_API_STORAGE=1` to force the API in preview branches
2. Redeploy.

Notes:
- Past winners and leaderboard data use the shared API when available. Without the KV env vars every visitor only sees their local scores.
- If KV env vars are not set, the app falls back to localStorage (per-browser only).
- API is built via `api/state.js` and is enabled by `vercel.json`.

## 🎯 How to Play

1. **Connect Wallet** - Click "CONNECT PHANTOM WALLET" (or install Phantom extension)
2. **Make Payment** - Pay 0.01 SOL for daily unlimited plays (simulated for demo)
3. **Play Game** - Use arrow keys, WASD, or touch controls to move the snake
4. **Eat Food** - Collect red food to grow and increase your score
5. **Avoid Collisions** - Don't hit walls or your own tail
6. **Compete** - Try to get the highest score to win the daily prize!

## 🎮 Controls

### Desktop
- **Arrow Keys** or **WASD** to move
- **ESC** to return to main menu

### Mobile
- **Touch Controls** on screen
- **Tap in game area** to change direction

## 📁 Project Structure

```
solana-snake-game/
├── src/
│   ├── main.js              # Entry point
│   ├── game.js              # Complete game with all scenes
│   └── mockStateClient.js   # Mock blockchain client for demo
├── index.html               # Game host page
├── package.json             # Dependencies and scripts
├── vite.config.js           # Build configuration
├── .gitignore              # Git ignore file
└── README.md               # This file
```

## 🎨 Game Scenes

- **BootScene** - Loads assets and initializes the game
- **MenuScene** - Main menu with wallet connection and payment
- **GameScene** - The actual Snake game
- **GameOverScene** - Game over screen with score
- **LeaderboardScene** - Daily leaderboard (coming soon)

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run serve` - Serve production build

### Development Notes

- Uses a **mock state client** for development (no real blockchain calls)
- **Phantom wallet integration** is ready but uses mock data
- **Responsive design** works on both desktop and mobile
- **Audio requires user interaction** due to browser autoplay policies

## 🚀 Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 🌐 Deployment

The game can be deployed to any static hosting service:

- **Vercel** - `vercel --prod`
- **Netlify** - Connect your GitHub repository
- **GitHub Pages** - Enable in repository settings
- **Any static host** - Upload the `dist` folder

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Phaser.js](https://phaser.io/) - Game framework
- [Vite](https://vitejs.dev/) - Build tool
- [Solana](https://solana.com/) - Blockchain platform
- [Phantom Wallet](https://phantom.app/) - Solana wallet

## 🎉 Enjoy the Game!

Have fun playing Snake and competing for the daily prizes! If you enjoy this game, please give it a ⭐ star!

---

**Made with ❤️ and Phaser.js**
## 💾 Local Persistence

- Game data persists across refresh via `localStorage` using the mock `StateClient`.
- Two JSON stubs are included for future backend persistence or manual export:
  - `public/data/daily_scores.json` — structure mirror for daily scores
  - `public/data/past_winners.json` — structure mirror for past winners

Note: Static files are not writable from the browser; the app saves to `localStorage` in development. A real backend can sync these files or store to a database.
