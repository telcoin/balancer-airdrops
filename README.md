# Balancer Rewards Calculator

## Summary

the javascript file `calculate.js` can take one TELx balancer pool and output the balances, accrued rewards, claimed rewards, and pending rewards for each staker.

To achieve this, the StakingRewards contract logic was basically translated from solidity to javascript, and the polygonscan api was used to get all the ERC20 transfer events to/from the staking contract. When a user sends LP tokens to the contract, the `stake` function is called, when LP tokens are withdrawn the `withdraw` function is called, and when TEL is moved from the staking contract, a counter is incremented to reflect the amount that user has claimed. 

## How to use

change `POOL_NAME` in `calculate.js` to whatever pool you want.

change `SNAPSHOT_DURATION` to whatever (it's currently set to 1 day)

`$ npm i`

`$ node calculate.js`

sometimes polygonscan will return non-json and the script will die. if this happens just run it again i don't know why this happens.

## Output

The script will do its calculation and write to `./${POOL_NAME}.json`

`snapshots` maps to an array of snapshots. Each snapshot contains a start and end block, and a map of addresses to:

* `balance` (LP token balance at the end of the snapshot period)
* `totalEarned` (the TOTAL amount of TEL the staker SHOULD have received by the end of this snapshot period if the contract was working)
* `earnedThisPeriod` (the amount they should have earned during this snapshot period)
* `totalClaimed` (the total amount of TEL the user has claimed from the contract)
* `claimedThisPeriod` (the amount of TEL they have claimed this period)

`finalState` is a map of addresses to their final, current values at the time of running the script. each address has:

* `balance` (current LP token balance)
* `totalEarned` (the total amount of TEL the user would have earned if the contract was working)
* `totalClaimed` (the total amount of TEL the user has claimed from the contract)
* `rewardPending` (the amount of TEL that the user COULD withdraw from the contract at this time)

## Testing

To test the script, I did the following for 3 or 4 of the pools:

Look at the transaction history for the staking contract and pick out an address that has staked once or only a few times in very short succession. 

calculate approximately what they should be owed: (total TEL to be distributed over 42 days) / 42 * (the user's LP tokens) / (total LP tokens in the contract) * (number of days the user has been staking)

run the script and see if the output agrees with the above calculation.

also check to make sure that  (sum of `totalClaimed` in `finalState`) + (amount of TEL in the contract) = amount of TEL to be distributed over 42 days

also make sure that for one or two of the addresses that did have `rewardPending` > 0, make sure the actual smart contract agrees