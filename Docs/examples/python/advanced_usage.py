"""
Advanced GRID API Usage Examples

Demonstrates advanced features including:
- Positions management
- Price history and charting
- Instruments discovery
- Transfers between accounts
- Market statistics
"""

import time
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from trading_client import GridTradingClient


class AdvancedGridClient:
    """Advanced GRID API client with helper methods"""
    
    def __init__(self, private_key: str, public_key: str):
        self.client = GridTradingClient(private_key, public_key)
    
    def get_portfolio_overview(self):
        """Get complete portfolio overview"""
        print('=== Portfolio Overview ===\n')
        
        # Get positions
        positions = self.client.get_positions(status='open')
        
        print(f'Open Positions: {len(positions)}')
        total_value = 0
        
        for pos in positions:
            value = float(pos.get('current_market_value', 0))
            cost = float(pos['total_cost'])
            pnl = value - cost
            pnl_pct = (pnl / cost) * 100
            
            print(f"  {pos['instrument_name']}:")
            print(f"    Quantity: {pos['quantity']} units")
            print(f"    Avg Cost: ${pos['average_cost']}")
            print(f"    Current Value: ${value:.2f}")
            print(f"    P&L: ${pnl:.2f} ({pnl_pct:+.2f}%)")
            
            total_value += value
        
        print(f'\nTotal Portfolio Value: ${total_value:.2f}\n')
        
        # Get account balances
        accounts = self.client.get_trading_accounts()
        
        print('Account Balances:')
        for acct in accounts:
            symbol = acct.get('instrument_symbol', acct.get('currency', 'Unknown'))
            print(f"  {symbol}:")
            print(f"    Available: {acct.get('available_balance', acct.get('available', 0))}")
            print(f"    Locked: {acct.get('locked_balance', acct.get('reserved', 0))}")
            print(f"    Total: {acct.get('total_balance', acct.get('total', 0))}")
        
        # Get consumption balance
        consumption = self.client.get_consumption_instruments()
        
        if consumption:
            print('\nConsumption Balances:')
            for inst in consumption:
                used_pct = (inst['tokens_used'] / inst['tokens_purchased']) * 100
                print(f"  {inst['instrument_name']}:")
                print(f"    Units: {inst['total_amount']} ({inst['tradeable_amount']} tradeable)")
                print(f"    Tokens: {inst['tokens_used']:,} / {inst['tokens_purchased']:,}")
                print(f"    Usage: {used_pct:.1f}%")
    
    def analyze_market(self, market_id: str, days: int = 30):
        """Analyze market with price history"""
        print(f'\n=== Market Analysis: {market_id} ===\n')
        
        # Get market stats
        stats = self.client.get_market_stats(market_id)
        
        print('24h Statistics:')
        print(f"  Current Price: ${stats['current_price']}")
        print(f"  24h Change: ${stats['price_change_24h']} ({stats['price_change_24h_percent']}%)")
        print(f"  24h High: ${stats['high_24h']}")
        print(f"  24h Low: ${stats['low_24h']}")
        print(f"  24h Volume: {stats['volume_24h']} units (${stats['volume_24h_value']})")
        
        # Get price history
        now = int(time.time())
        start = now - (days * 24 * 60 * 60)
        
        candles = self.client.get_price_history(market_id, '1d', start, now)
        
        print(f'\nPrice History ({days} days):')
        print(f'  Candles: {len(candles)}')
        
        if candles:
            first_candle = candles[0]
            last_candle = candles[-1]
            
            price_change = float(last_candle['close']) - float(first_candle['open'])
            price_change_pct = (price_change / float(first_candle['open'])) * 100
            
            print(f"  Period Start: ${first_candle['open']}")
            print(f"  Period End: ${last_candle['close']}")
            print(f"  Period Change: ${price_change:.2f} ({price_change_pct:+.2f}%)")
            
            # Calculate volatility
            closes = [float(c['close']) for c in candles]
            returns = [(closes[i] - closes[i-1]) / closes[i-1] for i in range(1, len(closes))]
            
            avg_return = sum(returns) / len(returns)
            variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
            volatility = (variance ** 0.5) * 100
            
            print(f"  Volatility: {volatility:.2f}%")
            
            # Total volume
            total_volume = sum(c['volume'] for c in candles)
            print(f"  Total Volume: {total_volume} units")
    
    def find_best_ai_models(
        self,
        min_context_window: int = 100000,
        max_price: float = 100
    ) -> List[Dict]:
        """Find best AI commodity instruments"""
        print('\n=== AI Model Search ===\n')
        print(f'Criteria: Context >= {min_context_window:,}, Price <= ${max_price}\n')
        
        instruments = self.client.list_instruments()
        ai_instruments = [i for i in instruments if i['instrument_type'] == 'ai_commodity']
        
        qualified = []
        
        for inst in ai_instruments:
            details = self.client.get_instrument(inst['instrument_id'])
            
            if not details.get('ai_specs') or not details['ai_specs'].get('context_window'):
                continue
            
            if details['ai_specs']['context_window'] >= min_context_window:
                price = float(details['last_trade_price']) if details['last_trade_price'] else None
                
                if not price or price <= max_price:
                    qualified.append({
                        'symbol': details['symbol'],
                        'instrument_id': details['instrument_id'],
                        'context_window': details['ai_specs']['context_window'],
                        'throughput': details['ai_specs']['token_throughput'],
                        'price': price or 'N/A',
                        'models': details['ai_specs'].get('qualifying_models', [])
                    })
        
        # Sort by context window (descending)
        qualified.sort(key=lambda x: x['context_window'], reverse=True)
        
        print(f'Found {len(qualified)} qualifying instruments:\n')
        
        for inst in qualified:
            print(f"{inst['symbol']}:")
            print(f"  Context Window: {inst['context_window']:,} tokens")
            print(f"  Throughput: {inst['throughput']} tokens/sec")
            print(f"  Price: ${inst['price']:.2f}" if isinstance(inst['price'], (int, float)) else f"  Price: {inst['price']}")
            print(f"  Models: {', '.join(inst['models']) if inst['models'] else 'None listed'}")
            print('')
        
        return qualified
    
    def buy_for_ai_consumption(
        self,
        market_id: str,
        instrument_id: str,
        quantity: int
    ):
        """Complete workflow: Buy and prepare for AI consumption"""
        print('\n=== Buy and Prepare for AI Consumption ===\n')
        
        # Step 1: Check consumption balance
        consumption = self.client.get_consumption_instruments()
        existing = next((i for i in consumption if i['instrument_id'] == instrument_id), None)
        
        if existing and existing['tradeable_amount'] >= quantity:
            print(f"✓ Already have {existing['tradeable_amount']} units in consumption")
            return
        
        # Step 2: Check trading balance
        trading_accounts = self.client.get_trading_accounts()
        trading_acct = next((a for a in trading_accounts if a.get('instrument_id') == instrument_id), None)
        
        available_balance = int(trading_acct['available_balance']) if trading_acct else 0
        
        if available_balance < quantity:
            print(f'Insufficient trading balance. Need {quantity}, have {available_balance}')
            print('Placing buy order...')
            
            # Get current market price
            ticker = self.client.get_ticker(market_id)
            buy_price = float(ticker.get('lowest_ask', ticker.get('last_price', 0)))
            
            # Place limit order at current ask
            order = self.client.place_order(
                market_id=market_id,
                side='buy',
                order_type='limit',
                quantity=str(quantity),
                price=f'{buy_price:.2f}',
                time_in_force='gtc'
            )
            
            print(f"✓ Order placed: {order['order_id']}")
            print('  Waiting for fill...')
            
            # In production, use WebSocket to wait for fill
            time.sleep(5)
        else:
            print(f'✓ Sufficient trading balance: {available_balance} units')
        
        # Step 3: Transfer to consumption
        print(f'Transferring {quantity} units to consumption...')
        
        transfer = self.client.transfer_to_consumption(instrument_id, quantity)
        print(f"✓ Transfer initiated: {transfer['transfer_id']}")
        
        # Step 4: Confirm transfer
        print('Waiting for transfer completion...')
        
        completed = False
        attempts = 0
        
        while not completed and attempts < 10:
            time.sleep(2)
            
            history = self.client.get_transfer_history(limit=100)
            transfer_record = next((t for t in history if t['transfer_id'] == transfer['transfer_id']), None)
            
            if transfer_record:
                print('✓ Transfer completed')
                completed = True
            
            attempts += 1
        
        if not completed:
            print('⚠ Transfer taking longer than expected. Check transfer history.')
        
        print('\n✓ Units ready for AI consumption!')
    
    def analyze_transfer_patterns(self, market_id: str, days: int = 30):
        """Analyze transfer patterns over time"""
        print(f'\n=== Transfer Pattern Analysis ({days} days) ===\n')
        
        history = self.client.get_transfer_history(market_id=market_id)
        
        # Filter to last N days
        cutoff = datetime.now() - timedelta(days=days)
        recent = [
            t for t in history
            if datetime.fromisoformat(t['transferred_at'].replace('Z', '+00:00')) > cutoff
        ]
        
        # Analyze by direction
        to_consumption = [t for t in recent if 'consumption' in t['account_id']]
        to_trading = [t for t in recent if 'trading' in t['account_id']]
        
        # Calculate totals by instrument
        instrument_totals = defaultdict(lambda: {'to_consumption': 0, 'to_trading': 0})
        
        for t in to_consumption:
            instrument_totals[t['instrument_id']]['to_consumption'] += t['quantity']
        
        for t in to_trading:
            instrument_totals[t['instrument_id']]['to_trading'] += t['quantity']
        
        # Report
        print(f"Total Transfers: {len(recent)}")
        print(f"  To Consumption: {len(to_consumption)}")
        print(f"  To Trading: {len(to_trading)}")
        
        print('\nBy Instrument:')
        for inst_id, totals in instrument_totals.items():
            print(f"  {inst_id}:")
            print(f"    → Consumption: {totals['to_consumption']} units")
            print(f"    → Trading: {totals['to_trading']} units")
            net = totals['to_consumption'] - totals['to_trading']
            print(f"    Net Flow: {net:+d} units")


if __name__ == '__main__':
    # Load keys from files
    with open('./ed25519.key', 'r') as f:
        private_key = f.read().strip()
    
    with open('./ed25519_pub.der', 'r') as f:
        public_key = f.read().strip()
    
    # Initialize client
    client = AdvancedGridClient(private_key, public_key)
    
    try:
        # Get portfolio overview
        client.get_portfolio_overview()
        
        # Analyze market
        markets = client.client.get_markets()
        if markets:
            market_id = markets[0]['market_id']
            
            client.analyze_market(market_id, days=30)
            
            # Find best AI models
            best_models = client.find_best_ai_models(
                min_context_window=100000,
                max_price=100
            )
            
            if best_models:
                print(f'\nRecommended: {best_models[0]["symbol"]}')
            
            # Analyze transfer patterns
            client.analyze_transfer_patterns(market_id, days=7)
        
    except Exception as e:
        print(f'Error: {e}')


