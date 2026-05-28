# 💰 Finance Wallet

> **A powerful personal finance dashboard** — track your capital, project your future, simulate your financial runway across the globe, and manage your wealth in one elegant dark-themed app.

---

## ✨ Features

### 📊 Dashboard
- **Real-time capital overview** with min / median / max projections
- **Modular & draggable blocks** — reorder, hide, or show any block via long-press
- **Capital projection chart** with configurable simulation date (+1m, +3m, +6m, +1 year)
- **Goals tracker** with percentage progress bar
- **What-if Scenarios** — add custom events (income spikes, one-time costs) and see their impact
- **⚔️ War Economy Mode** — toggle to simulate minimum-spend life: compares capital with/without reducible & cancellable expenses

### 💸 Transactions
- **Quick add** — log income or expense in seconds
- **Recurring items** — salary, rent, subscriptions with full edit support (inline form)
- **Range amounts** — define min/max amounts for variable income or expenses
- **History view** — grouped by month with monthly income & expense totals per header
- **Salary module** — configure recurring salary with frequency & date range
- **Trésorerie** — optional treasury balance that can be included in capital calculations

### ⚔️ War Economy
- Mark any recurring expense as:
  - **Annulable** 🚫 — can be cancelled next month
  - **Réductible** ✂️ — can be reduced to a minimal price
- Dashboard block shows savings breakdown and capital comparison in "peace" vs "war" mode

### 🌍 Runway Calculator
- See how many months your capital lasts in **any country** (150+ countries)
- Compare multiple countries side by side
- **Sort by**: runway (most → fewest months), cost (cheapest → most expensive), name
- **Show/hide the main destination block** when not needed
- Customize housing, food, and transport costs with defaults pre-filled per country
- Deduct flight cost + extras automatically

### 🗺️ Trip Estimator
- Plan travel to any country with fully editable budget fields (flight, accommodation, food, activities, extras)
- Realistic defaults auto-filled based on destination's cost of living
- See total trip cost and per-day breakdown

### 💹 Cost of Living
- Browse 150+ countries sorted and filterable
- Monthly budget, housing, food, transport, and typical flight cost from France
- Add custom countries

### 📈 Investments
- Track **crypto**, **stocks**, **gold**, **real estate**, and **ETFs**
- Live crypto prices via CoinGecko API
- Add/remove holdings with quantity, buy price, and current value
- Overview with total portfolio value and P&L

### 🏦 Pockets (Savings Jars)
- Create named savings goals with target amounts
- Track progress visually
- Allocate capital towards specific objectives

### ⚙️ Settings
- Set your capital initial value
- Configure a financial goal (€ target)
- Set webhook notifications (Discord / Telegram)
- Export / import your data as JSON
- Reset layout to default

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Styling | Tailwind CSS v4 |
| State | React Context + `localStorage` persistence |
| Charts | [Recharts](https://recharts.org/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Crypto Prices | [CoinGecko API](https://www.coingecko.com/en/api) (free tier) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/finance-wallet.git
cd finance-wallet

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.js          # Root layout + StoreProvider
│   ├── page.js            # Entry point
│   └── api/
│       └── crypto/        # Server-side CoinGecko price proxy
├── components/
│   ├── Dashboard.js       # Main dashboard with modular blocks
│   ├── Transactions.js    # Income / expense / recurring / history
│   ├── Tools.js           # Runway, Trip Estimator, Cost of Living
│   ├── Investments.js     # Portfolio tracker
│   ├── Settings.js        # App configuration
│   └── Nav.js             # Collapsible sidebar navigation
├── lib/
│   ├── store.js           # Global state (React Context + localStorage)
│   ├── utils.js           # Math engine (capital, runway, war economy)
│   ├── constants.js       # Categories, frequencies, COST_OF_LIVING data
│   └── cryptoData.js      # Symbol → CoinGecko ID mapping
```

---

## 🗄️ Data & Privacy

- **All data is stored locally** in your browser's `localStorage` — nothing is sent to any server.
- The only external API call is to **CoinGecko** for live crypto prices (server-side proxied).
- No authentication, no database, no cloud sync — your data stays on your device.

> To back up your data: go to **Settings → Export** and download a JSON snapshot.

---

## 🔧 Configuration

All data is seeded from an empty state — no personal defaults are included. On first launch:

1. Set your **current capital** in Settings → Général
2. Add your **recurring income** (salary, freelance…) in Transactions → Récurrents
3. Add your **recurring expenses** (rent, subscriptions…) in Transactions → Récurrents
4. (Optional) Set a **financial goal** in Settings
5. (Optional) Add your **crypto/stock portfolio** in Investments

---

## 🌐 Deployment

This is a standard Next.js app. You can deploy it to:

- **Vercel** (recommended): connect your GitHub repo and deploy in one click
- **Netlify**: `npm run build && netlify deploy --dir=.next`
- **Self-hosted**: use `npm run build && npm start` with a reverse proxy (nginx, Caddy…)

---

## 🤝 Contributing

PRs and issues are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push and open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
