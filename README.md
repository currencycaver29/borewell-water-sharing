# Borewell Water Sharing Board

A lightweight, offline-first Progressive Web Application (PWA) prototype designed to solve complex shared-resource scheduling for agricultural communities. 

This application programmatically schedules, tracks, and manages 56 weekly hours of shared borewell water pumping across 8 members, proportionally allocating water access based on individual land acreage. 

## Features
* **Algorithmic Roster Generation:** Automatically generates a fair 7-day schedule (8 hours/day) based on a mathematical distribution of each farmer's acreage.
* **Turn Trading (Swap Engine):** A transactional system allowing farmers to request and accept shift trades securely.
* **Hostage-Pump Prevention:** A "Force Override Protocol" ensures no farmer can indefinitely monopolize the pump. If a farmer overruns their turn, the next scheduled farmer can forcefully terminate the session and flag a dispute.
* **Offline-First Mode:** Since rural areas often lack internet connectivity, the app caches state via `localStorage` and queues transactions to sync when a connection is restored.
* **Pumping Analytics:** Logs power-cut downtime and calculates net water pumped versus scheduled time, tracking "owed" hours accurately.
* **Glassmorphism UI:** A premium, fully responsive mobile-first dark theme.

## Setup Guide

Because this is a pure client-side application (HTML/CSS/JS) with no backend, deployment and setup is instantaneous.

### Option 1: Live Demo (Recommended)
You can view the live, fully functional application immediately on GitHub Pages:
👉 **[Live Application URL](https://currencycaver29.github.io/borewell-water-sharing/)**

### Option 2: Local Development
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/currencycaver29/borewell-water-sharing.git
   ```
2. Navigate into the directory:
   ```bash
   cd borewell-water-sharing
   ```
3. Open `index.html` directly in any modern web browser. No local server, build tools, or Node.js environment is required.

### Logging In (Demo Accounts)
The application is pre-seeded with 8 test users. To test the PIN pad and features, use any of the following credentials:
* **Member 01**: PIN `1111`
* **Member 02**: PIN `2222`
* **Member 03**: PIN `3333`
* **Admin Controls**: Navigate to Settings and use PIN `0000` to wipe the database and trigger a hard reset.
