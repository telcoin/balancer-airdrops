import * as dotenv from 'dotenv';
import { BigNumber, ethers } from 'ethers';
import * as fs from 'fs';
import {assert} from "chai";

dotenv.config();

import { getTimestampsOfBlocks, getTransfers } from './api/alchemy';
import { FakeStaking } from './helpers/fakeStakingContract';

const LPT_ADDRESS = "0x2dbC9Ab0160087AE59474FB7bed95B9E808fA6bc".toLowerCase();
const STAKING_ADDRESS = "0xfab274069a8203143c396b388fb4b6729fcc76df".toLowerCase();
const TEL_ADDRESS = '0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32'.toLowerCase();

const START_BLOCK = 26249420;
const END_BLOCK = 29814387;

const STAKE_TIME_THRESHOLD = 5184000; // 60 days in seconds
const REWARDS_DURATION = 7776000; // 90 days in seconds

const REWARDS_AMOUNT = 10_000_000;

const REPORT_FILE = "./reports/dfxkpi.csv"

function writeReport(data: {[key:string]:number}) {
    let s = '';
    Object.entries(data).forEach(v => {
        s += `erc20,${TEL_ADDRESS},${v[0]},${v[1]}\n`;
    });
    fs.writeFileSync(REPORT_FILE, s);
}

(async () => {
    const fakeStaking = new FakeStaking();
    
    const transfers = (await getTransfers(LPT_ADDRESS, 0, END_BLOCK)).filter(tx => {
        return tx.from === STAKING_ADDRESS || tx.to === STAKING_ADDRESS
    });
    
    const blockNumbers = Array.from(new Set(transfers.map(tx => Number(tx.blockNum))));

    console.log('fetching block timestamps');
    const blockToTimestamp = await getTimestampsOfBlocks([START_BLOCK, END_BLOCK, ...blockNumbers]);
    console.log('done fetching');
    
    const startTs = blockToTimestamp[START_BLOCK];
    const endTs = blockToTimestamp[END_BLOCK];

    // run transfers through fakeStaking

        // once we hit start block, setRewardsDuration and notifyRewardAmount
        // also record each staked user's "stakeTime" as start block ts
        // start recording each stake event for its stakeTime (if the staker is not already staked)
        // also start recording complete unstake events to update totalStakeDuration 
    

    // run through totalStakeDuration of each user. filter out all those who fall below threshold of 60 days
    // sum earned for all eligible users, and scale up their earned amount by (total incl ineligible users) / (total only eligible users)

    type StakeTimeRecord = {
        stakeTime: number,
        stakeDuration: number
    };

    const stakeTimeRecords: {[key:string]: StakeTimeRecord} = {};

    transfers.forEach(tx => {
        const value = ethers.BigNumber.from(tx.rawContract.value);
        const ts = blockToTimestamp[Number(tx.blockNum)];
        const account = tx.from === STAKING_ADDRESS ? tx.to : tx.from;

        assert(ts < endTs, "timestamps don't make sense");

        if (ts > startTs && fakeStaking.rewardsDuration.eq('0')) {
            fakeStaking.setRewardsDuration(REWARDS_DURATION);
            fakeStaking.notifyRewardAmount(REWARDS_AMOUNT, startTs);
        }

        if (stakeTimeRecords[account] === undefined) {
            stakeTimeRecords[account] = {
                stakeTime: startTs,
                stakeDuration: 0
            };
        }

        if (tx.to === STAKING_ADDRESS) {
            // stake event
            if (ts > startTs && (fakeStaking.balances[account] === undefined || fakeStaking.balances[account].eq('0'))) {
                stakeTimeRecords[account].stakeTime = ts;
            }

            fakeStaking.stake(account, value, ts);
        }
        else if (tx.from === STAKING_ADDRESS) {
            // unstake event
            fakeStaking.withdraw(account, value, ts);

            if (ts > startTs && fakeStaking.balances[account].eq('0')) {
                assert(ts > stakeTimeRecords[account].stakeTime, "problem");

                stakeTimeRecords[account].stakeDuration += ts - stakeTimeRecords[account].stakeTime
            }
        }
        else {
            console.log("something is broken");
            process.exit();
        }
    });

    assert(Object.keys(stakeTimeRecords).length === Object.keys(fakeStaking.balances).length, "lengths do not match");

    // update stakeDuration for all addresses that are still staked at the end of the period
    Object.keys(stakeTimeRecords).forEach(account => {
        if (fakeStaking.balances[account].gt('0')) {
            stakeTimeRecords[account].stakeDuration += endTs - stakeTimeRecords[account].stakeTime;
        }
    });

    const eligibleAddresses = Object.keys(stakeTimeRecords).filter(account => stakeTimeRecords[account].stakeDuration >= STAKE_TIME_THRESHOLD);
    const totalEarnedAmongEligible = eligibleAddresses.reduce((prev, curr, i) => {
        const earned = fakeStaking.earned(curr, endTs);
        return prev.add(earned);
    }, ethers.BigNumber.from('0'));

    const owedToEligibleAddresses: {[key:string]: number} = {};
    let pp = 0;
    eligibleAddresses.forEach(account => {
        const bnTimes100 = ethers.BigNumber.from(REWARDS_AMOUNT).mul(1e18+'').mul(fakeStaking.earned(account, endTs)).div(totalEarnedAmongEligible).div(1e16+'');
        owedToEligibleAddresses[account] = Number(bnTimes100) / 100;
        pp += owedToEligibleAddresses[account];
    });

    assert(Math.abs(pp - REWARDS_AMOUNT) < 1, "doesn't add up");

    writeReport(owedToEligibleAddresses);
})();