# TokenVault – Production-Grade Upgradeable Smart Contract System (UUPS)

A production-grade upgradeable smart contract system implementing the **Universal Upgradeable Proxy Standard (UUPS)** pattern across a complete three-version lifecycle (**V1 → V2 → V3**). Built with Hardhat and OpenZeppelin Upgradeable Contracts, the system preserves state invariants, enforces storage layout integrity with storage gaps, enforces least-privilege role-based access control, and guarantees zero-collision upgrades.

---

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Contract Versions & Lifecycle](#contract-versions--lifecycle)
- [Storage Layout & Gap Strategy](#storage-layout--gap-strategy)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Business Logic & Mathematical Models](#business-logic--mathematical-models)
- [Installation & Setup](#installation--setup)
- [Compilation & Testing](#compilation--testing)
- [Test Coverage Report](#test-coverage-report)
- [Deployment & Upgrade Procedures](#deployment--upgrade-procedures)
- [Security Considerations & Known Design Decisions](#security-considerations--known-design-decisions)
- [Repository Structure](#repository-structure)

---

## 🏗️ Architecture Overview

The system utilizes the **UUPS (Universal Upgradeable Proxy Standard - ERC-1822 / ERC-1967)** architecture:
- **Proxy Contract**: Holds all persistent storage, token balances, and contract ether/ERC20 balances. User transactions are dispatched to the proxy, which delegates calls via `DELEGATECALL` to the active logic contract.
- **Logic / Implementation Contracts (`TokenVaultV1`, `TokenVaultV2`, `TokenVaultV3`)**: Contain the executable business logic.
- **Upgrade Mechanism**: Upgrade logic resides directly in the implementation contract via `_authorizeUpgrade(address newImplementation)`, restricted to authorized addresses holding `UPGRADER_ROLE`.
- **UUPS vs. Transparent Proxy**: UUPS eliminates the need for an external `ProxyAdmin` contract and avoids the runtime gas overhead of admin address checks on every invocation, leading to lower deployment and transaction execution costs.

---

## 🚀 Contract Versions & Lifecycle

### 1. TokenVaultV1
- Core ERC20 token vault.
- Deposit functionality with configurable fee deduction (basis points).
- Immediate withdrawal functionality.
- Accounting for per-user balances and global total deposits.
- Role-based permissions: `DEFAULT_ADMIN_ROLE`, `UPGRADER_ROLE`, `PAUSER_ROLE`.
- Constructor with `_disableInitializers()` and `initializer` modifier.

### 2. TokenVaultV2 (Yield & Pause Controls)
- Inherits `TokenVaultV1` and `PausableUpgradeable`.
- Non-compounding annual yield accrual based on time elapsed and user balance.
- Deposit checkpointing that prevents double-claiming and accurately credits accrued yield.
- Granular deposit pause and unpause controls governed by `PAUSER_ROLE`.
- `reinitializer(2)` for safe post-upgrade initialization.

### 3. TokenVaultV3 (Timelocked Withdrawals & Emergency Exits)
- Inherits `TokenVaultV2`.
- Timelocked withdrawal delay mechanism: users submit a withdrawal request, wait for the configurable delay window to pass, and call `executeWithdrawal()`.
- Single pending request enforcement: any new request cancels/resets the previous pending request.
- Immediate `emergencyWithdraw()` bypassing delay periods to guarantee user exit safety.
- `reinitializer(3)` for safe delay parameter initialization.

---

## 🧠 Storage Layout & Gap Strategy

In EVM proxy patterns, state variables must strictly retain their assigned storage slots across upgrades. Variables are never removed, reordered, or modified in type.

### Storage Slot Allocation

| Contract | Slot(s) | Variable | Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| **TokenVaultV1** | 0 | `token` | `IERC20` | Underlying deposit token |
| | 1 | `depositFee` | `uint256` | Fee in basis points (e.g. 500 = 5%) |
| | 2 | `_totalDeposits` | `uint256` | Net total vault deposits |
| | 3 | `balances` | `mapping(address => uint256)` | Depositor credited balances |
| | 4 .. 48 | `__gap` | `uint256[45]` | Storage gap reserving 49 slots total |
| **TokenVaultV2** | 49 | `yieldRate` | `uint256` | Annual yield in basis points |
| | 50 | `lastClaimTime` | `mapping(address => uint256)` | Checkpoint timestamp per user |
| | 51 .. 93 | `__gap` | `uint256[43]` | Reduced gap: $45 - 2 = 43$ slots |
| **TokenVaultV3** | 94 | `withdrawalDelay` | `uint256` | Enforced delay in seconds |
| | 95 | `withdrawalRequests` | `mapping(address => WithdrawalRequest)` | Active withdrawal requests |
| | 96 .. 136 | `__gap` | `uint256[41]` | Reduced gap: $43 - 2 = 41$ slots |

*Note: Constant variables (`UPGRADER_ROLE`, `PAUSER_ROLE`) are stored directly in bytecode and do not consume storage slots.*

---

## 🔐 Role-Based Access Control (RBAC)

The system uses OpenZeppelin's `AccessControlUpgradeable` to enforce the principle of least privilege:

- `DEFAULT_ADMIN_ROLE`: System administrator. Authorized to grant and revoke roles, and configure system parameters such as `setYieldRate` and `setWithdrawalDelay`.
- `UPGRADER_ROLE`: Authorized to invoke `upgradeToAndCall` / `upgradeTo` via `_authorizeUpgrade`.
- `PAUSER_ROLE`: Authorized to trigger operational safeguards via `pauseDeposits()` and `unpauseDeposits()`. Decoupled from admin roles to limit operational blast radius.

---

## 📐 Business Logic & Mathematical Models

### V1 Deposit Fee Calculation
When a user deposits $A$ tokens with fee $F$ basis points ($1 \text{ bp} = 0.01\%$):
$$\text{Fee} = \frac{A \times F}{10000}$$
$$\text{Credited Amount} = A - \text{Fee}$$
- User's credited balance increases by $\text{Credited Amount}$.
- Total deposits increase by $\text{Credited Amount}$.

### V2 Yield Accrual Calculation
Yield is linear and uncompounded:
$$\text{Yield} = \frac{\text{userBalance} \times \text{yieldRate} \times \Delta t}{365 \text{ days} \times 10000}$$
- $\Delta t = \text{block.timestamp} - \text{lastClaimTime}[\text{user}]$.
- If a user has never claimed or deposited in V2, $\text{lastClaimTime}[address(0)]$ represents the vault activation time.
- If user balance is 0 or yield rate is 0, accrued yield is strictly 0.
- Checkpoints update on deposit and claim to prevent double-claiming.

### V3 Timelocked Withdrawal Delay
1. **Request**: User calls `requestWithdrawal(amount)`. Sets $\text{requestTime} = \text{block.timestamp}$.
2. **Cancellation**: A subsequent `requestWithdrawal` overwrites the existing request with updated parameters and a fresh timestamp.
3. **Execution**: After $\text{block.timestamp} \ge \text{requestTime} + \text{withdrawalDelay}$, user invokes `executeWithdrawal()` to transfer tokens and decrement balance.
4. **Emergency Exit**: `emergencyWithdraw()` immediately withdraws 100% of user balance and deletes active requests, bypassing delay constraints.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js $\ge 18.0.0$
- npm $\ge 9.0.0$

### Setup
```bash
git clone https://github.com/sucha6174/token-vault-uups.git
cd token-vault-uups
npm install
```

---

## ⚙️ Compilation & Testing

### Compile Contracts
```bash
npm run compile
# or
npx hardhat compile
```

### Run Test Suite
```bash
npm test
# or
npx hardhat test
```

### Run Automated Coverage
```bash
npm run coverage
# or
npx hardhat coverage
```

---

## 📊 Test Coverage Report

The repository includes 41 comprehensive tests spanning unit operations, cross-version upgrades, role security, and storage layout integrity:

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `contracts/TokenVaultV1.sol` | **100%** | **100%** | **100%** | **100%** | None |
| `contracts/TokenVaultV2.sol` | **100%** | **86.67%** | **100%** | **100%** | None |
| `contracts/TokenVaultV3.sol` | **100%** | **87.5%** | **100%** | **100%** | None |
| `contracts/mocks/MockERC20.sol` | **100%** | **100%** | **100%** | **100%** | None |
| **All Files Total** | **100%** | **90.32%** | **100%** | **100%** | **None** |

All statements, functions, and lines achieve **100% coverage**, with branches achieving **90.32%**, satisfying the $\ge 90\%$ requirement.

---

## 🚀 Deployment & Upgrade Procedures

### 1. Deploy TokenVaultV1
```bash
npx hardhat run scripts/deploy-v1.js --network <network>
```
Output logs will provide the deployed `MockERC20` address and `TokenVaultV1` proxy address.

### 2. Upgrade to TokenVaultV2
Set the proxy address and run the upgrade script:
```bash
export PROXY_ADDRESS="0xYourProxyAddress"
npx hardhat run scripts/upgrade-to-v2.js --network <network>
```

### 3. Upgrade to TokenVaultV3
```bash
export PROXY_ADDRESS="0xYourProxyAddress"
npx hardhat run scripts/upgrade-to-v3.js --network <network>
```

---

## 🛡️ Security Considerations & Known Design Decisions

1. **Implementation Initialization Lockout**:
   All implementation contract constructors invoke `_disableInitializers()` to permanently lock implementation addresses against direct initialization or ownership takeovers.
2. **UUPS Upgrade Authorization**:
   Only accounts explicitly granted `UPGRADER_ROLE` can invoke upgrades. Reverts occur if unauthorized callers attempt an upgrade.
3. **Storage Layout Preservation**:
   All upgrades undergo validation via OpenZeppelin's storage validation tools (`upgrades.validateUpgrade`). Layout collisions and variable shifts are strictly prevented.
4. **Non-Reentrant & Balanced State Accounting**:
   State balances are decremented before external ERC20 token transfers to adhere to the Checks-Effects-Interactions pattern.
5. **Granular Access Control**:
   `PAUSER_ROLE` is isolated from administrative governance to prevent privilege escalation and minimize operational risks during emergency pauses.

---

## 📁 Repository Structure

```
your-repo/
├── contracts/
│   ├── TokenVaultV1.sol
│   ├── TokenVaultV2.sol
│   ├── TokenVaultV3.sol
│   └── mocks/
│       └── MockERC20.sol
├── test/
│   ├── TokenVaultV1.test.js
│   ├── upgrade-v1-to-v2.test.js
│   ├── upgrade-v2-to-v3.test.js
│   └── security.test.js
├── scripts/
│   ├── deploy-v1.js
│   ├── upgrade-to-v2.js
│   └── upgrade-to-v3.js
├── hardhat.config.js
├── package.json
├── submission.yml
└── README.md
```
