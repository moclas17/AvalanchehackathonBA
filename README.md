Avalanche Hackathon Buenos Aires
Funding L1 Nodes through C-Chain to Pay P-Chain Fees in USDC or Any ERC20 Token

This repository aims to facilitate paying fees to the P-Chain for an L1 blockchain validator via the C-Chain, preparing for the upcoming Avalanche 9000 process.

The tool allows for periodic transactions to swap USDC (or other tokens) to AVAX. This function executes the swap at specified intervals (cronjob functionality not developed yet). Next, the AVAX is transferred to the L1 node's deployer wallet, enabling fee payments for the node.
