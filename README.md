# Balancer Rewards Calculator

## Summary

This repository has scripts for calculating rewards for some balancer pools as well as the 60/90 day bonus for TEL/DFX/USDC stakers.

## Usage

Put your alchemy API key in `.env` like so:
```
ALCHEMYKEY="..."
```

`$ yarn install`

both scripts will output a csv to `./reports`

### balPools.ts

Adjust `WEEK_NUMBER` to current week.

`$ ts-node balPools.ts`

### dfxkpi.ts

Adjust `START_BLOCK` and `END_BLOCK`

`$ ts-node dfxkpi.ts`
