const fs = require('fs');

const POOL_NAME = 'TEL60WETH20USDC20';


const OUTPUT = require(`./${POOL_NAME}.json`);


const address = "0xa78d59f05acf567e60f70b8bdae5c88825c5b3c1".toLowerCase();
const lpBal = 3154;
const d = 7+9/24;

const totalTel = 3000000;
const lpTotal = 1000000;

// const napkin = totalTel / 42 * lpBal / lpTotal * d;
const napkin = totalTel / 42 * lpBal / lpTotal * d + totalTel/42*3154/lpTotal*7.5/24;

console.log(napkin);

console.log(OUTPUT.finalState[address].totalEarned/1e18)

fs.writeFileSync(`./test-results/${POOL_NAME}_${address}`, `${POOL_NAME}\n${address}\n\npredicted: \t${napkin}\nactual: \t${OUTPUT.finalState[address].totalEarned/1e18}`);