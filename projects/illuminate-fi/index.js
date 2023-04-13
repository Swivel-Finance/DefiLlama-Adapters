const { getLogs } = require('../helper/cache/getLogs')
const { sumTokens2 } = require('../helper/unwrapLPs')

async function tvl(_, _b, _cb, { api, }) {
  const market = '0xcd1d02fda51cd24123e857ce94e4356d5c073b3f'
  const createMarketLogs = await getLogs({
    api,
    target: market,
    topics: ['0xb02abdc1b2e46d6aa310c4e8bcab63f9ec42f82c0bba87fefe442f2b21d60871'],
    eventAbi: 'event CreateMarket (address indexed underlying, uint256 indexed maturity, address[9] tokens, address element, address apwine)',
    onlyArgs: true,
    fromBlock: 16973041,
  })
  const setPoolLogs = await getLogs({
    api,
    target: market,
    topics: ['0x55209e3c7f85dc20f4a87c5797c01f02e573346bef47c8b034f89ace44a985a4'],
    eventAbi: 'event SetPool (address indexed underlying, uint256 indexed maturity, address indexed pool)',
    onlyArgs: true,
    fromBlock: 16973041,
  });

  const calls = createMarketLogs.map(i => ( { params: [i.underlying, +i.maturity]}))
  const pools = await api.multiCall({ abi: 'function pools(address, uint256) view returns (address)', calls, target: market })
  const baseTokens = await api.multiCall({ abi: 'address:baseToken', calls: pools })
  const sharesTokens = await api.multiCall({ abi: 'address:sharesToken', calls: pools })
  const ownerTokens = pools.map((v, i) => [[baseTokens[i], sharesTokens[i]], v])

  // Add the value of the principal tokens in the pool
  const principalTokens = await api.multiCall({ abi: 'address:fyToken', calls: pools })
  const principalTokenDecimals = await api.multiCall({ abi: 'uint256:decimals', calls: pools })
  const oneCalls = createMarketLogs.map(i => ( { params: 10**principalTokenDecimals[i] } ) )
  const principalTokenPrices = await api.multiCall({ abi: 'function sellFYTokenPreview(uint256) view returns (uint256)', oneCalls, calls: pools })
  
  const balanceOfCalls = setPoolLogs.map(i => ( { params: [i.pool]}))
  const principalTokenBalances = await api.multiCall( { abi: 'function balanceOf(address) view returns (uint256)', balanceOfCalls, calls: principalTokens })
  
  // sum up the balance held by the pools weighted by their current price
  var principalTokenTvl = 0 
  principalTokenBalances.forEach((v, i) => principalTokenTvl += v * principalTokenPrices / 10**principalTokenDecimals[i])

  return sumTokens2({ api, ownerTokens, }) + principalTokenTvl;
}

module.exports = {
  ethereum: { tvl }
}