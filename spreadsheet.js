const POOLS = [
    'TEL60WMATIC20USDC20',
    'TEL60AAVE20USDC20',
    'TEL60WBTC20USDC20',
    'TEL60BAL20USDC20',
    'TEL80USDC20',
    'TEL50BAL50',
    'TEL60WETH20USDC20'
];
const ethers = require('ethers');
const fs = require('fs');

POOLS.forEach(POOL_NAME => {    
    const INPUT = require(`./${POOL_NAME}.json`);
    const state = INPUT.finalState;
    
    const addys = Object.keys(state);
    
    
    let outputString = 'Address,AmountToAirdrop,AmountEarned,AmountClaimed,AmountPendingClaim\n';
    
    addys.forEach(addy => {
        const x = state[addy];
        const a = ethers.BigNumber.from(x.totalEarned).sub(ethers.BigNumber.from(x.totalClaimed)).sub(ethers.BigNumber.from(x.rewardPending))/1e18;
        
        outputString += [addy, a, x.totalEarned/1e18, x.totalClaimed/1e18, x.rewardPending/1e18].join(',') + '\n';
    })
    
    fs.writeFileSync(`./csvs/${POOL_NAME}.csv`, outputString);
})