1. Which tools, extensions, plugins and support did you use when deploying a PolkaVM smart contract?

Hardhat + @nomicfoundation/hardhat-toolbox for compilation and deployment. Foundry for fuzz tests. ethers.js v6 for deploy scripts and the coordinator service. Blockscout for contract verification on Paseo. MetaMask for frontend wallet. Polkadot Faucet for testnet tokens.


q. What did you like about smart contracts on Polkadot? What smart contract features would encourage you to choose Polkadot over other platforms?  What feature/s of Polkadot's smart contracts did you find most valuable?

XCM as a native primitive is the killer feature. Being able to call into other parachains directly from a Solidity contract via the XCM precompile — that's something no other EVM chain offers. For FlashDot, this meant I could build a cross-chain 2PC protocol without relying on third-party bridges or messaging layers. The fact that it's built into the runtime, not bolted on, makes a real difference in trust assumptions. Also, low gas costs on testnet made iteration fast.


2. Any technical challenges while deploying or interacting with smart contracts on Polkadot? Any frustrations or things that didn't work as expected? Let us know.

Gas estimates on Hub EVM were off compared to Ethereum — had to add buffer multipliers to stop random out-of-gas failures. The XCM precompile (0x0000...0800) only exists on the live runtime, so I had to write a MockXcmPrecompile for local testing which was a lot of extra work. Block finality on testnet was flaky at times, causing the coordinator to miss events with HTTP polling — had to switch to WebSocket.


3. Was there anything missing, confusing, or hard to find in the documentation?

XCM precompile docs were the biggest gap. Figuring out how to call XCM from Solidity — parameter encoding, weight, QueryResponse callbacks — was mostly trial and error. A reference Solidity contract with a basic XCM Transact + ACK example would've saved a lot of time. Also, EVM-specific info (supported opcodes, precompile addresses, gas model) is scattered across too many places.


4. How would you describe your onboarding experience as a new user of Polkadot smart contracts? What can be improved?

Basic EVM deployment was straightforward — Hardhat just works once you have the RPC and chain ID. Blockscout and faucet are good. The friction is all around XCM integration from Solidity. A starter Hardhat template with Hub network config and a sample cross-chain call would go a long way.
