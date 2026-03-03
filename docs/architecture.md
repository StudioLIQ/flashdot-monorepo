# Architecture

## High-level

```mermaid
flowchart TD
    subgraph Hub[Polkadot Hub EVM]
      H[FlashDotHub]
      BE[Bond Escrow]
      SM[2PC State Machine]
    end

    subgraph VaultA[Parachain A]
      VA[FlashDotVault A]
      PA[LP Pool A]
    end

    subgraph VaultB[Parachain B]
      VB[FlashDotVault B]
      PB[LP Pool B]
    end

    U[Borrower]
    LP[Liquidity Providers]
    CO[Coordinator Service]
    FE[Frontend]

    LP --> PA
    LP --> PB

    U -->|createLoan + lock bond| H
    H --> BE
    H --> SM

    SM -->|XCM prepare| VA
    SM -->|XCM prepare| VB
    SM -->|XCM commit| VA
    SM -->|XCM commit| VB

    VA -->|ACK| H
    VB -->|ACK| H

    U -->|repay| VA
    U -->|repay| VB

    CO -->|event-driven automation| H
    FE -->|wallet UX + polling| H
```

## Lifecycle

1. Borrower locks bond on Hub.
2. Hub sends prepare XCM to each vault.
3. ACK success => commit phase.
4. Borrower repays committed legs.
5. Settle returns bond minus fees.
6. If expired unpaid => default triggers bond slash payout.

## Key Safety Properties

- Economic atomicity through pre-funded bond.
- Committed leg irreversibility.
- Idempotent vault endpoints for duplicated/reordered cross-chain calls.
