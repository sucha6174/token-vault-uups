# TokenVault – Production-Grade Upgradeable Smart Contract System (UUPS)

This repository contains a **production-grade upgradeable smart contract system** built using the **UUPS (Universal Upgradeable Proxy Standard)** pattern.  
The project demonstrates a full **upgrade lifecycle (V1 → V2 → V3)** while preserving state, enforcing security, and following OpenZeppelin best practices.

This system is inspired by real-world DeFi protocols that must safely upgrade contracts holding user funds.

---

## 🚀 Features Overview

### ✅ TokenVaultV1
- ERC20 token vault
- Deposit & withdraw functionality
- Configurable deposit fee (basis points)
- Tracks user balances and total deposits
- UUPS upgrade support
- Secure initializer pattern

### ✅ TokenVaultV2 (Upgrade)
- Yield generation (APR-based, non-compounding)
- Time-based yield calculation
- Pause / unpause deposits
- Role-based access control (admin, upgrader, pauser)
- State preserved across upgrade

### ✅ TokenVaultV3 (Final Upgrade)
- Withdrawal delay mechanism (request → wait → execute)
- One pending withdrawal per user
- Emergency withdrawal (bypass delay)
- Secure state migration from V2
- Upgrade-safe storage extension

---

## 🏗️ Architecture

### 🔹 UUPS Proxy Pattern
- Proxy holds **all state**
- Logic contracts (V1, V2, V3) can be replaced
- Upgrade authorization handled inside implementation (`_authorizeUpgrade`)
- Lower gas overhead than Transparent Proxy

### 🔹 Why UUPS?
- Explicit upgrade authorization
- Smaller proxy bytecode
- Used by major protocols (Aave-style pattern)

---

## 🧠 Storage Layout Strategy

Upgradeable contracts **must never reorder or remove storage variables**.

This project follows strict rules:
- Existing storage is **never modified**
- New variables are **only appended**
- Each version includes a **storage gap (`__gap`)**
- Gap size is reduced as new variables are added

This prevents **storage collisions** across upgrades.

---

## 🔐 Security Design

### ✔ Initialization Safety
- No constructors in logic contracts
- `initializer` / `reinitializer(n)` used correctly
- `_disableInitializers()` called in constructors
- Direct initialization of implementations is blocked

### ✔ Access Control
- `DEFAULT_ADMIN_ROLE` – system admin
- `UPGRADER_ROLE` – upgrade permission
- `PAUSER_ROLE` – pause/unpause deposits
- Unauthorized upgrades are prevented

### ✔ Upgrade Safety
- OpenZeppelin upgrade validation
- Storage layout validated across V1 → V2 → V3
- Selector collision checks included in tests

---

## 🧪 Testing Strategy

The test suite covers:
- Core business logic (deposits, withdrawals, fees)
- Yield calculation correctness
- Pause functionality
- Withdrawal delay enforcement
- Emergency withdrawal
- State preservation across upgrades
- Unauthorized upgrade prevention
- Initialization attack prevention
- Storage layout safety

**Total:** ✅ 23 passing tests

---

## 📁 Project Structure

contracts/
├── TokenVaultV1.sol
├── TokenVaultV2.sol
├── TokenVaultV3.sol
└── mocks/
└── MockERC20.sol

test/
├── TokenVaultV1.test.js
├── upgrade-v1-to-v2.test.js
├── upgrade-v2-to-v3.test.js
└── security.test.js

scripts/
├── deploy-v1.js
├── upgrade-to-v2.js
└── upgrade-to-v3.js