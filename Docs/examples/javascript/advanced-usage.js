/**
 * Advanced GRID API Usage Examples
 * 
 * Demonstrates advanced features including:
 * - Positions management
 * - Price history and charting
 * - Instruments discovery
 * - Transfers between accounts
 * - Market statistics
 */

const axios = require('axios');
const { SignatureAuth } = require('./auth');
const { GridTradingClient } = require('./trading-client');

class AdvancedGridClient {
  constructor(privateKey, publicKey) {
    this.client = new GridTradingClient(privateKey, publicKey);
  }

  /**
   * Get complete portfolio overview
   */
  async getPortfolioOverview() {
    console.log('=== Portfolio Overview ===\n');
    
    // Get positions
    const positions = await this.client.getPositions({ status: 'open' });
    
    console.log(`Open Positions: ${positions.length}`);
    let totalValue = 0;
    
    for (const pos of positions) {
      const value = parseFloat(pos.current_market_value) || 0;
      const cost = parseFloat(pos.total_cost);
      const pnl = value - cost;
      const pnlPct = (pnl / cost) * 100;
      
      console.log(`  ${pos.instrument_name}:`);
      console.log(`    Quantity: ${pos.quantity} units`);
      console.log(`    Avg Cost: $${pos.average_cost}`);
      console.log(`    Current Value: $${value.toFixed(2)}`);
      console.log(`    P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`);
      
      totalValue += value;
    }
    
    console.log(`\nTotal Portfolio Value: $${totalValue.toFixed(2)}\n`);
    
    // Get account balances
    const accounts = await this.client.getTradingAccounts();
    
    console.log('Account Balances:');
    for (const acct of accounts) {
      console.log(`  ${acct.instrument_symbol || acct.currency}:`);
      console.log(`    Available: ${acct.available_balance}`);
      console.log(`    Locked: ${acct.locked_balance || acct.reserved}`);
      console.log(`    Total: ${acct.total_balance || acct.total}`);
    }
    
    // Get consumption balance
    const consumption = await this.client.getConsumptionInstruments();
    
    if (consumption.length > 0) {
      console.log('\nConsumption Balances:');
      for (const inst of consumption) {
        const usedPct = (inst.tokens_used / inst.tokens_purchased) * 100;
        console.log(`  ${inst.instrument_name}:`);
        console.log(`    Units: ${inst.total_amount} (${inst.tradeable_amount} tradeable)`);
        console.log(`    Tokens: ${inst.tokens_used.toLocaleString()} / ${inst.tokens_purchased.toLocaleString()}`);
        console.log(`    Usage: ${usedPct.toFixed(1)}%`);
      }
    }
  }

  /**
   * Analyze market with price history
   */
  async analyzeMarket(marketId, days = 30) {
    console.log(`\n=== Market Analysis: ${marketId} ===\n`);
    
    // Get market stats
    const stats = await this.client.getMarketStats(marketId);
    
    console.log('24h Statistics:');
    console.log(`  Current Price: $${stats.current_price}`);
    console.log(`  24h Change: $${stats.price_change_24h} (${stats.price_change_24h_percent}%)`);
    console.log(`  24h High: $${stats.high_24h}`);
    console.log(`  24h Low: $${stats.low_24h}`);
    console.log(`  24h Volume: ${stats.volume_24h} units ($${stats.volume_24h_value})`);
    
    // Get price history
    const now = Math.floor(Date.now() / 1000);
    const start = now - (days * 24 * 60 * 60);
    
    const candles = await this.client.getPriceHistory(marketId, '1d', start, now);
    
    console.log(`\nPrice History (${days} days):`);
    console.log(`  Candles: ${candles.length}`);
    
    if (candles.length > 0) {
      const firstCandle = candles[0];
      const lastCandle = candles[candles.length - 1];
      
      const priceChange = parseFloat(lastCandle.close) - parseFloat(firstCandle.open);
      const priceChangePct = (priceChange / parseFloat(firstCandle.open)) * 100;
      
      console.log(`  Period Start: $${firstCandle.open}`);
      console.log(`  Period End: $${lastCandle.close}`);
      console.log(`  Period Change: $${priceChange.toFixed(2)} (${priceChangePct.toFixed(2)}%)`);
      
      // Calculate volatility
      const closes = candles.map(c => parseFloat(c.close));
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        const ret = (closes[i] - closes[i-1]) / closes[i-1];
        returns.push(ret);
      }
      
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * 100;
      
      console.log(`  Volatility: ${volatility.toFixed(2)}%`);
      
      // Calculate total volume
      const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);
      console.log(`  Total Volume: ${totalVolume} units`);
    }
  }

  /**
   * Find best AI commodity instruments
   */
  async findBestAIModels(minContextWindow = 100000, maxPrice = 100) {
    console.log('\n=== AI Model Search ===\n');
    console.log(`Criteria: Context >= ${minContextWindow}, Price <= $${maxPrice}\n`);
    
    const instruments = await this.client.listInstruments();
    const aiInstruments = instruments.filter(i => i.instrument_type === 'ai_commodity');
    
    const qualified = [];
    
    for (const inst of aiInstruments) {
      const details = await this.client.getInstrument(inst.instrument_id);
      
      if (!details.ai_specs || !details.ai_specs.context_window) continue;
      
      if (details.ai_specs.context_window >= minContextWindow) {
        const price = details.last_trade_price ? parseFloat(details.last_trade_price) : null;
        
        if (!price || price <= maxPrice) {
          qualified.push({
            symbol: details.symbol,
            instrumentId: details.instrument_id,
            contextWindow: details.ai_specs.context_window,
            throughput: details.ai_specs.token_throughput,
            price: price || 'N/A',
            models: details.ai_specs.qualifying_models || []
          });
        }
      }
    }
    
    // Sort by context window (descending)
    qualified.sort((a, b) => b.contextWindow - a.contextWindow);
    
    console.log(`Found ${qualified.length} qualifying instruments:\n`);
    
    qualified.forEach(inst => {
      console.log(`${inst.symbol}:`);
      console.log(`  Context Window: ${inst.contextWindow.toLocaleString()} tokens`);
      console.log(`  Throughput: ${inst.throughput} tokens/sec`);
      console.log(`  Price: ${typeof inst.price === 'number' ? '$' + inst.price.toFixed(2) : inst.price}`);
      console.log(`  Models: ${inst.models.length > 0 ? inst.models.join(', ') : 'None listed'}`);
      console.log('');
    });
    
    return qualified;
  }

  /**
   * Complete workflow: Buy and prepare for AI consumption
   */
  async buyForAIConsumption(marketId, instrumentId, quantity) {
    console.log('\n=== Buy and Prepare for AI Consumption ===\n');
    
    // Step 1: Check if we have enough in consumption already
    const consumption = await this.client.getConsumptionInstruments();
    const existingInst = consumption.find(i => i.instrument_id === instrumentId);
    
    if (existingInst && existingInst.tradeable_amount >= quantity) {
      console.log(`✓ Already have ${existingInst.tradeable_amount} units in consumption`);
      return;
    }
    
    // Step 2: Check trading balance
    const tradingAccounts = await this.client.getTradingAccounts();
    const tradingAcct = tradingAccounts.find(a => a.instrument_id === instrumentId);
    
    const availableBalance = tradingAcct ? parseInt(tradingAcct.available_balance) : 0;
    
    if (availableBalance < quantity) {
      console.log(`Insufficient trading balance. Need ${quantity}, have ${availableBalance}`);
      console.log('Placing buy order...');
      
      // Get current market price
      const ticker = await this.client.getTicker(marketId);
      const buyPrice = parseFloat(ticker.lowest_ask) || parseFloat(ticker.last_price);
      
      // Place limit order at current ask
      const order = await this.client.placeOrder({
        market_id: marketId,
        side: 'buy',
        type: 'limit',
        quantity: quantity.toString(),
        price: buyPrice.toFixed(2),
        time_in_force: 'gtc'
      });
      
      console.log(`✓ Order placed: ${order.order_id}`);
      console.log('  Waiting for fill...');
      
      // In production, use WebSocket to wait for fill
      // For demo, we'll just wait a bit
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log(`✓ Sufficient trading balance: ${availableBalance} units`);
    }
    
    // Step 3: Transfer to consumption
    console.log(`Transferring ${quantity} units to consumption...`);
    
    const transfer = await this.client.transferToConsumption(instrumentId, quantity);
    console.log(`✓ Transfer initiated: ${transfer.transfer_id}`);
    
    // Step 4: Confirm transfer
    console.log('Waiting for transfer completion...');
    
    let completed = false;
    let attempts = 0;
    
    while (!completed && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const history = await this.client.getTransferHistory(null, 100);
      const transferRecord = history.find(t => t.transfer_id === transfer.transfer_id);
      
      if (transferRecord) {
        console.log('✓ Transfer completed');
        completed = true;
      }
      
      attempts++;
    }
    
    if (!completed) {
      console.log('⚠ Transfer taking longer than expected. Check transfer history.');
    }
    
    console.log('\n✓ Units ready for AI consumption!');
  }

  /**
   * Monitor market activity
   */
  async monitorMarket(marketId, durationMinutes = 5) {
    console.log(`\n=== Monitoring ${marketId} for ${durationMinutes} minutes ===\n`);
    
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    
    let tradeCount = 0;
    let totalVolume = 0;
    const priceHistory = [];
    
    while (Date.now() < endTime) {
      try {
        // Get recent trades
        const trades = await this.client.getPublicTrades(marketId, 5);
        
        if (trades.length > 0) {
          const latestTrade = trades[0];
          const price = parseFloat(latestTrade.price);
          priceHistory.push(price);
          
          console.log(`Trade: ${latestTrade.quantity} @ $${latestTrade.price} (${latestTrade.side})`);
          
          tradeCount++;
          totalVolume += parseInt(latestTrade.quantity);
        }
        
        // Get current order book
        const orderBook = await this.client.getOrderBook(marketId, 5);
        
        if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
          const [bidPrice, bidQty] = orderBook.bids[0];
          const [askPrice, askQty] = orderBook.asks[0];
          const spread = parseFloat(askPrice) - parseFloat(bidPrice);
          const spreadPct = (spread / parseFloat(bidPrice)) * 100;
          
          console.log(`  Bid: $${bidPrice} (${bidQty}) | Ask: $${askPrice} (${askQty}) | Spread: ${spreadPct.toFixed(3)}%`);
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
        
      } catch (error) {
        console.error(`Error during monitoring: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n=== Monitoring Summary ===');
    console.log(`Duration: ${durationMinutes} minutes`);
    console.log(`Trades Observed: ${tradeCount}`);
    console.log(`Total Volume: ${totalVolume} units`);
    
    if (priceHistory.length > 1) {
      const minPrice = Math.min(...priceHistory);
      const maxPrice = Math.max(...priceHistory);
      const avgPrice = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
      
      console.log(`Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
      console.log(`Average Price: $${avgPrice.toFixed(2)}`);
    }
  }

  /**
   * Backtest a simple trading strategy
   */
  async backtestStrategy(marketId, days = 30) {
    console.log(`\n=== Backtesting Strategy on ${marketId} ===\n`);
    
    // Get historical data
    const now = Math.floor(Date.now() / 1000);
    const start = now - (days * 24 * 60 * 60);
    
    const candles = await this.client.getPriceHistory(marketId, '1h', start, now);
    
    console.log(`Loaded ${candles.length} hourly candles`);
    
    // Simple SMA crossover strategy
    let position = null;
    let cash = 10000;
    const trades = [];
    
    const calculateSMA = (data, period) => {
      const closes = data.map(c => parseFloat(c.close));
      return closes.reduce((a, b) => a + b, 0) / period;
    };
    
    for (let i = 20; i < candles.length; i++) {
      const currentPrice = parseFloat(candles[i].close);
      const sma20 = calculateSMA(candles.slice(i - 20, i), 20);
      
      // Buy signal: price crosses above SMA
      if (!position && currentPrice > sma20) {
        position = {
          entry: currentPrice,
          quantity: cash / currentPrice
        };
        cash = 0;
        trades.push({
          type: 'buy',
          price: currentPrice,
          quantity: position.quantity,
          time: candles[i].time
        });
        
        console.log(`BUY: ${position.quantity.toFixed(2)} units @ $${currentPrice.toFixed(2)}`);
      }
      // Sell signal: price crosses below SMA
      else if (position && currentPrice < sma20) {
        cash = position.quantity * currentPrice;
        trades.push({
          type: 'sell',
          price: currentPrice,
          quantity: position.quantity,
          time: candles[i].time
        });
        
        const pnl = cash - (position.quantity * position.entry);
        const pnlPct = (pnl / (position.quantity * position.entry)) * 100;
        
        console.log(`SELL: ${position.quantity.toFixed(2)} units @ $${currentPrice.toFixed(2)}`);
        console.log(`  P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`);
        
        position = null;
      }
    }
    
    // Close position if still open
    if (position) {
      const lastPrice = parseFloat(candles[candles.length - 1].close);
      cash = position.quantity * lastPrice;
      console.log(`CLOSE: ${position.quantity.toFixed(2)} units @ $${lastPrice.toFixed(2)}`);
    }
    
    // Results
    const finalValue = cash;
    const totalReturn = ((finalValue - 10000) / 10000) * 100;
    
    console.log('\n=== Backtest Results ===');
    console.log(`Initial Capital: $10,000.00`);
    console.log(`Final Value: $${finalValue.toFixed(2)}`);
    console.log(`Total Return: ${totalReturn.toFixed(2)}%`);
    console.log(`Number of Trades: ${trades.length}`);
    console.log(`Win Rate: ${this.calculateWinRate(trades).toFixed(1)}%`);
  }

  calculateWinRate(trades) {
    let wins = 0;
    let totalTrades = 0;
    
    for (let i = 0; i < trades.length - 1; i += 2) {
      if (trades[i].type === 'buy' && trades[i + 1].type === 'sell') {
        if (trades[i + 1].price > trades[i].price) {
          wins++;
        }
        totalTrades++;
      }
    }
    
    return totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  }

  /**
   * Smart instrument selector
   */
  async selectBestInstrument(requirements) {
    console.log('\n=== Finding Best Instrument ===\n');
    console.log('Requirements:', requirements);
    
    const instruments = await this.client.listInstruments();
    const aiInstruments = instruments.filter(i => i.instrument_type === 'ai_commodity');
    
    const candidates = [];
    
    for (const inst of aiInstruments) {
      const details = await this.client.getInstrument(inst.instrument_id);
      
      if (!details.ai_specs) continue;
      
      // Check requirements
      let score = 0;
      let qualifies = true;
      
      if (requirements.minContextWindow) {
        if (details.ai_specs.context_window >= requirements.minContextWindow) {
          score += 10;
        } else {
          qualifies = false;
        }
      }
      
      if (requirements.minThroughput) {
        if (details.ai_specs.token_throughput >= requirements.minThroughput) {
          score += 10;
        } else {
          qualifies = false;
        }
      }
      
      if (requirements.serviceType) {
        if (details.basic_info.service_type === requirements.serviceType) {
          score += 5;
        } else {
          qualifies = false;
        }
      }
      
      if (requirements.maxPrice && details.last_trade_price) {
        if (parseFloat(details.last_trade_price) <= requirements.maxPrice) {
          score += 10;
        } else {
          qualifies = false;
        }
      }
      
      if (qualifies) {
        candidates.push({
          ...details,
          score
        });
      }
    }
    
    // Sort by score
    candidates.sort((a, b) => b.score - a.score);
    
    console.log(`\nFound ${candidates.length} qualifying instruments:\n`);
    
    candidates.forEach((inst, idx) => {
      console.log(`${idx + 1}. ${inst.symbol}`);
      console.log(`   Context: ${inst.ai_specs.context_window.toLocaleString()} tokens`);
      console.log(`   Throughput: ${inst.ai_specs.token_throughput} t/s`);
      console.log(`   Price: ${inst.last_trade_price ? '$' + inst.last_trade_price : 'N/A'}`);
      console.log(`   Score: ${inst.score}/35`);
      console.log('');
    });
    
    return candidates.length > 0 ? candidates[0] : null;
  }
}

// Example usage
if (require.main === module) {
  const fs = require('fs');
  
  const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();
  const publicKey = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();
  
  const client = new AdvancedGridClient(privateKey, publicKey);
  
  (async () => {
    try {
      // Get portfolio overview
      await client.getPortfolioOverview();
      
      // Analyze a market
      const markets = await client.client.getMarkets();
      if (markets.length > 0) {
        await client.analyzeMarket(markets[0].market_id, 30);
        
        // Backtest strategy
        await client.backtestStrategy(markets[0].market_id, 30);
      }
      
      // Find best AI model
      const best = await client.selectBestInstrument({
        minContextWindow: 100000,
        minThroughput: 30,
        serviceType: 'text_generation',
        maxPrice: 100
      });
      
      if (best) {
        console.log(`\nRecommended: ${best.symbol}`);
      }
      
    } catch (error) {
      console.error('Error:', error.message);
    }
  })();
}

module.exports = { AdvancedGridClient };


