# 🐍 Solana Snake Game

A complete Snake game built with Phaser.js that integrates with Solana blockchain for payments and leaderboards.

## 🎮 Game Features

- **Classic Snake Gameplay** - Eat food, grow longer, avoid collisions
- **Solana Wallet Integration** - Connect with Phantom wallet
- **Mobile-Friendly Controls** - Touch controls for mobile devices
- **Daily Payment System** - Pay 0.01 SOL for unlimited daily plays
- **Leaderboard System** - Compete for daily prizes
- **Audio Support** - Background music and sound effects
- **Responsive Design** - Works on desktop and mobile

## 🚀 Quick Start

The development server should already be running! If not, run:

```bash
npm run dev
```

Then open your browser and go to: **http://localhost:3000**

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
├── src/
│   ├── main.js              # Entry point
│   ├── game.js              # Complete game with all scenes
│   └── mockStateClient.js   # Mock blockchain client for demo
├── index.html               # Game host page
├── package.json             # Dependencies and scripts
├── vite.config.js           # Build configuration
└── README.md               # This file
```

## 🎨 Game Scenes

- **BootScene** - Loads assets and initializes the game
- **MenuScene** - Main menu with wallet connection and payment
- **GameScene** - The actual Snake game
- **GameOverScene** - Game over screen with score
- **LeaderboardScene** - Daily leaderboard (coming soon)

## 🔧 Development Notes

- Uses a **mock state client** for development (no real blockchain calls)
- **Phantom wallet integration** is ready but uses mock data
- **Responsive design** works on both desktop and mobile
- **Audio requires user interaction** due to browser autoplay policies

## 🚀 Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## 🎉 Enjoy the Game!

The game is now ready to play! The development server should be running at http://localhost:3000. Have fun playing Snake and competing for the daily prizes!
