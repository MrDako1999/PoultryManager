# Project Foundation & Setup Guide

> Extracted from AutoShipper CRM — a full-stack MERN application with multi-tenancy, i18n (21 languages), role-based auth, and a shadcn/ui frontend. Use this as the blueprint for spinning up a new project with the same architecture.

---

## What AutoShipper Is

A multi-tenant CRM for auto-shipping brokers. Brokers get their own subdomain (or custom domain), manage vehicles through a 4-stage pipeline, track finances (charges + payments), import data from BidManager.io, and serve a customer portal. Features dark/light theming, RTL language support, Cloudinary & Hetzner S3 storage, and Vercel deployment with cron jobs.

---

## Tech Stack At a Glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 18+ | Server & build tooling |
| **Frontend Framework** | React 18 | UI |
| **Build Tool** | Vite 5 | Dev server, bundling, HMR |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS |
| **Component Library** | shadcn/ui (Radix primitives) | Accessible, composable components |
| **State Management** | Zustand 4 | Lightweight global stores |
| **Data Fetching** | TanStack React Query 5 | Server state, caching, mutations |
| **HTTP Client** | Axios 1.6 | API requests with interceptors |
| **Routing** | React Router 6 | Client-side routing with guards |
| **Forms** | React Hook Form 7 + Zod 3 | Validation & form state |
| **i18n** | i18next + react-i18next | 21 locales, RTL, browser detection |
| **Charts** | Recharts 2 | Dashboard visualizations |
| **Icons** | Lucide React | Consistent icon set |
| **Date Utilities** | date-fns 3 | Date formatting & manipulation |
| **Backend** | Express.js 4 | REST API |
| **Database** | MongoDB + Mongoose 8 | Document store & ODM |
| **Auth** | JWT (httpOnly cookies) | Stateless authentication |
| **Password Hashing** | bcryptjs | Secure credential storage |
| **File Upload** | Multer | Multipart form handling |
| **Cloud Storage** | Cloudinary / Hetzner S3 | Image & media hosting |
| **Deployment** | Vercel | Serverless hosting + crons |

---

## Project Structure

> **Important:** All frontend files use `.js` extension — no `.jsx` or `.tsx`.

```
project-root/
├── backend/
│   ├── config/
│   │   ├── db.js                  # MongoDB connection (with serverless caching)
│   │   └── cloudinary.js          # Cloudinary SDK setup
│   ├── middleware/
│   │   ├── auth.js                # JWT protect + role guards
│   │   └── tenantResolver.js      # Multi-tenant subdomain/domain resolution
│   ├── models/                    # Mongoose schemas
│   ├── routes/                    # Express route handlers
│   ├── services/                  # Business logic (sync, integrations, media)
│   ├── scripts/                   # Migrations & utilities
│   ├── server.js                  # Express entry point
│   ├── package.json
│   └── vercel.json                # Vercel serverless config + crons
│
├── frontend/
│   ├── public/                    # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                # shadcn/ui primitives (Button, Dialog, etc.)
│   │   ├── layouts/               # Page shells (AuthLayout, DashboardLayout)
│   │   ├── pages/
│   │   │   ├── auth/              # Login, Signup
│   │   │   └── dashboard/         # Main app pages
│   │   ├── lib/
│   │   │   ├── api.js             # Axios instance + interceptors
│   │   │   └── utils.js           # cn() helper, formatters
│   │   ├── stores/                # Zustand stores (auth, theme)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── i18n/
│   │   │   ├── index.js           # i18next config
│   │   │   ├── languages.js       # Language list + RTL flags
│   │   │   └── locales/           # JSON translation files
│   │   ├── App.js                 # Router + route definitions
│   │   ├── main.js                # ReactDOM.createRoot entry
│   │   └── index.css              # Tailwind directives + CSS variables
│   ├── index.html                 # Vite HTML entry
│   ├── vite.config.js             # Vite config (proxy, aliases)
│   ├── tailwind.config.js         # Tailwind theme + plugins
│   ├── postcss.config.js          # PostCSS (tailwind + autoprefixer)
│   ├── jsconfig.json              # Path aliases for JS (replaces tsconfig)
│   ├── package.json
│   └── vercel.json                # SPA rewrite rules
│
└── README.md
```

---

## Step-by-Step Setup

### 1. Initialize the Monorepo

```bash
mkdir my-project && cd my-project
mkdir backend frontend
git init
```

### 2. Backend Setup

```bash
cd backend
npm init -y
npm install express cors cookie-parser dotenv mongoose jsonwebtoken bcryptjs multer
npm install -D nodemon
```

**`backend/package.json`** scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

**`backend/server.js`** — Express entry:

```js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
// app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
```

**`backend/config/db.js`** — MongoDB connection:

```js
import mongoose from 'mongoose';

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

export default async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

**`backend/middleware/auth.js`** — JWT middleware:

```js
import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  let token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};
```

**`backend/.env`**:

```env
MONGODB_URI=mongodb://localhost:27017/myproject
JWT_SECRET=your-secret-key
JWT_EXPIRE=30d
FRONTEND_URL=http://localhost:5173
PORT=5001
```

> Add `"type": "module"` to `backend/package.json` for ES module imports.

---

### 3. Frontend Setup

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
```

> Vite's `react` template gives you `.jsx` files by default. Rename them all to `.js`:

```bash
find src -name "*.jsx" -exec sh -c 'mv "$1" "${1%.jsx}.js"' _ {} \;
```

Install the full dependency set:

```bash
# Core UI
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slot \
  @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast \
  @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-avatar \
  @radix-ui/react-checkbox @radix-ui/react-scroll-area @radix-ui/react-accordion \
  @radix-ui/react-alert-dialog @radix-ui/react-progress

# Styling & UI utilities
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate lucide-react cmdk

# Data & state
npm install @tanstack/react-query axios zustand

# Routing
npm install react-router-dom

# Forms
npm install react-hook-form @hookform/resolvers zod

# i18n
npm install i18next react-i18next i18next-browser-languagedetector

# Charts & dates
npm install recharts date-fns react-day-picker

# File upload
npm install react-dropzone

# Dev
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

### 4. Vite Configuration

**`frontend/vite.config.js`**:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});
```

---

### 5. Path Aliases (JS — no TypeScript)

**`frontend/jsconfig.json`**:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

---

### 6. Tailwind Configuration

**`frontend/tailwind.config.js`**:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        heading: ['Syne', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

---

### 7. Global CSS with Theme Variables

**`frontend/src/index.css`**:

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Syne:wght@600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 174 60% 51%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 174 60% 51%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 174 60% 51%;
    --primary-foreground: 210 40% 98%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 174 60% 51%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Outfit', sans-serif;
  }
}
```

---

### 8. Core Frontend Files

**`frontend/src/main.js`**:

```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

**`frontend/src/lib/api.js`** — Axios instance:

```js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**`frontend/src/lib/utils.js`** — Tailwind merge helper:

```js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

**`frontend/src/stores/authStore.js`** — Zustand auth:

```js
import { create } from 'zustand';
import api from '@/lib/api';

const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    set({ user: data.user });
    return data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null });
  },
}));

export default useAuthStore;
```

**`frontend/src/stores/themeStore.js`** — Zustand theme:

```js
import { create } from 'zustand';

const useThemeStore = create((set) => ({
  theme: localStorage.getItem('app-theme') || 'system',

  setTheme: (theme) => {
    localStorage.setItem('app-theme', theme);
    set({ theme });

    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  },
}));

export default useThemeStore;
```

---

### 9. shadcn/ui with Plain JS

shadcn/ui officially targets TypeScript, but every component works fine in `.js` files — just strip the type annotations. When adding components:

```bash
npx shadcn@latest init
```

Choose these options:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**
- Framework: **Vite**
- Use JSX in `.js` files (manually copy components and remove TS types)

Alternatively, install components and manually save them as `.js`:

```bash
npx shadcn@latest add button dialog dropdown-menu input label select \
  separator switch tabs toast tooltip popover avatar checkbox scroll-area
```

Then rename the generated `.tsx` files to `.js` and strip type annotations.

---

### 10. i18n Setup

**`frontend/src/i18n/index.js`**:

```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/english.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'app-language',
    },
  });

export default i18n;
```

---

### 11. Vercel Deployment

**`frontend/vercel.json`**:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-api.vercel.app/api/$1" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

**`backend/vercel.json`**:

```json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "server.js" }
  ]
}
```

---

### 12. Environment Variables Summary

| Variable | Location | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Backend | MongoDB connection string |
| `JWT_SECRET` | Backend | Token signing key |
| `JWT_EXPIRE` | Backend | Token expiry (e.g. `30d`) |
| `FRONTEND_URL` | Backend | CORS origin |
| `PORT` | Backend | Server port (default `5001`) |
| `NODE_ENV` | Both | `development` / `production` |
| `CLOUDINARY_CLOUD_NAME` | Backend | Image storage (if using Cloudinary) |
| `CLOUDINARY_API_KEY` | Backend | Cloudinary auth |
| `CLOUDINARY_API_SECRET` | Backend | Cloudinary auth |

---

### 13. Key Architectural Patterns

| Pattern | Implementation |
|---------|---------------|
| **Auth** | JWT in httpOnly cookies + Bearer header fallback |
| **API Layer** | Axios instance with 401 interceptor → auto redirect to `/login` |
| **Server State** | React Query for all API data (queries + mutations + cache invalidation) |
| **Client State** | Zustand for auth, theme, and UI-only state |
| **Forms** | React Hook Form + Zod schemas for validation |
| **Routing Guards** | Wrapper components that check auth store before rendering |
| **Dark Mode** | CSS class strategy via Zustand + `localStorage` |
| **Component Style** | shadcn/ui pattern — `cn()` utility merging Tailwind classes with `clsx` + `tailwind-merge` |
| **Multi-tenancy** | Express middleware resolves tenant from hostname |
| **File Uploads** | Multer on backend → Cloudinary/S3 → URL stored in MongoDB |
| **i18n** | JSON locale files, `useTranslation()` hook, RTL via `dir` attribute |
| **DB Connection** | Cached Mongoose connection for serverless cold starts |

---

### Quick Start Checklist

- [ ] Create `backend/` and `frontend/` directories
- [ ] Set up backend with Express, Mongoose, JWT auth
- [ ] Set up frontend with Vite React template (rename `.jsx` → `.js`)
- [ ] Install Tailwind CSS + shadcn/ui
- [ ] Configure `vite.config.js` with `@` alias and `/api` proxy
- [ ] Add `jsconfig.json` for path aliases
- [ ] Set up Zustand stores (auth + theme)
- [ ] Set up React Query provider
- [ ] Set up React Router with auth guards
- [ ] Set up i18next (even if starting with one language)
- [ ] Add global CSS with HSL theme variables
- [ ] Configure `.env` for backend
- [ ] Add Vercel configs for deployment
