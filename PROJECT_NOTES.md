# TokenVault – Project Notes (For Interview Review)

## 1. Why I built this project
- To learn production-grade upgradeable smart contracts
- To understand UUPS proxy pattern
- To practice safe upgrades without losing state

## 2. Why UUPS instead of Transparent Proxy
- Lower gas cost
- Upgrade logic controlled by implementation
- Explicit upgrade authorization
- Commonly used in modern DeFi protocols

## 3. Upgrade flow
- V1: Deposit, withdraw, deposit fee
- V2: Yield generation, pause functionality
- V3: Withdrawal delay, emergency withdrawal

## 4. Storage safety strategy
- Never reordered or removed variables
- Only appended new variables
- Used storage gaps in every version
- Verified storage safety using OpenZeppelin upgrade validation

## 5. Security considerations
- Disabled initializers on implementation contracts
- Used role-based access control
- Prevented unauthorized upgrades
- Added emergency withdrawal for user safety

## 6. Testing approach
- Unit tests for V1
- Upgrade tests for V1→V2 and V2→V3
- Security tests for:
  - Unauthorized upgrades
  - Direct initialization
  - Storage layout safety
  - Function selector collisions

## 7. What I would improve next
- Add timelock for upgrades
- Add governance module
- Integrate real yield source
- Deploy to testnet
