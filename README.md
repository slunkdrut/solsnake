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
