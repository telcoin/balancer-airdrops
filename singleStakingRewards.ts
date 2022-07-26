import * as dotenv from 'dotenv';
import { ethers } from 'ethers';
import * as fs from 'fs';

dotenv.config();

import { getTimestampOfBlock, getTimestampsOfBlocks, getTransfers } from './api/alchemy';
import { FakeStaking } from './helpers/fakeStakingContract';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const START_BLOCK = 29814387;
const END_BLOCK = 30961388;

const REWARDS_DURATION = 2592000;
const REWARDS_AMOUNT = 3_333_333;

const STAKING_TOKEN = "0x2dbC9Ab0160087AE59474FB7bed95B9E808fA6bc".toLowerCase();
const REWARD_TOKEN = "0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32".toLowerCase();
const STAKING_CONTRACT = "0xfAB274069A8203143c396B388fb4B6729FcC76Df".toLowerCase();

(async () => {
    console.log('fetching transfers...');
    const transfers = await getTransfers(STAKING_TOKEN, 0, END_BLOCK);
    const blockNumbers = Array.from(new Set(transfers.map(tx => Number(tx.blockNum))));

    console.log('fetching timestamps...');
    const blockToTimestamp = await getTimestampsOfBlocks(blockNumbers);
    const startTimestamp = await getTimestampOfBlock(START_BLOCK);
    const endTimestamp = await getTimestampOfBlock(END_BLOCK);

    console.log('done fetching data');

    const fakeStaking = new FakeStaking();

    for (let i = 0; i < transfers.length; i++) {
        // somewhere in this loop we have to turn on the staking contract by calling owner methods
        const tx = transfers[i];
        const blockNum = Number(tx.blockNum);
        const timestamp = blockToTimestamp[blockNum];
        const value = ethers.BigNumber.from(tx.rawContract.value);

        if (timestamp >= startTimestamp && fakeStaking.lastUpdateTime.eq(0)) {
            // it's time to turn on rewards
            fakeStaking.setRewardsDuration(REWARDS_DURATION);
            fakeStaking.notifyRewardAmount(REWARDS_AMOUNT, startTimestamp);
        }

        if (tx.from === ZERO_ADDRESS && tx.to === ZERO_ADDRESS) {
            continue;
        }

        if (tx.to === STAKING_CONTRACT) {
            fakeStaking.stake(tx.from, value, timestamp);
        }
        else if (tx.from === STAKING_CONTRACT) {
            fakeStaking.withdraw(tx.to, value, timestamp);
        }
    }

    let accounts: string[] = [];
    let amounts: number[] = [];

    Object.keys(fakeStaking.balances).forEach(account => {
        if (fakeStaking.earned(account, endTimestamp).div(1e16+'').gt(0)) {
            accounts.push(account);
            amounts.push(Number(fakeStaking.earned(account, endTimestamp).div(1e16+'')));
        }
    })

    console.log('accounts:');
    console.log(JSON.stringify(accounts));
    
    console.log('amounts:');
    console.log(JSON.stringify(amounts));

    console.log(`intended reward amount: ${REWARDS_AMOUNT}, actual: ${amounts.reduce((t,c)=>t+c,0)/100}`);
})();

