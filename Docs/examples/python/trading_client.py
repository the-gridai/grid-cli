"""
GRID Trading API Client (Python)

Complete client for interacting with the GRID Trading API
"""

import json
import requests
import time
from typing import Optional, Dict, List, Any
from urllib.parse import urlencode

from auth import SignatureAuth


class GridTradingClient:
    """
    Complete client for GRID Trading API
    """
    
    def __init__(
        self,
        private_key: str,
        public_key: str,
        base_url: str = 'https://trading.api.thegrid.ai/v1'
    ):
        """
        Initialize the trading client
        
        Args:
            private_key: Base64-encoded Ed25519 private key
            public_key: Base64-encoded Ed25519 public key
            base_url: API base URL
        """
        self.auth = SignatureAuth(private_key, public_key)
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Any:
        """
        Make an authenticated API request
        
        Args:
            method: HTTP method
            path: Request path
            data: Request body (for POST/PUT)
            params: Query parameters (for GET)
        
        Returns:
            Response data
        
        Raises:
            requests.HTTPError: If request fails
        """
        body = json.dumps(data) if data else ''
        headers = self.auth.get_headers(method, path, body)
        
        url = f"{self.base_url}{path}"
        
        response = self.session.request(
            method=method,
            url=url,
            headers=headers,
            json=data,
            params=params
        )
        
        response.raise_for_status()
        return response.json()
    
    # ==================== Markets ====================
    
    def get_markets(self) -> List[Dict]:
        """
        List all available markets
        
        Returns:
            List of market objects
        """
        response = self._request('GET', '/trading/markets')
        return response['data']
    
    def get_market(self, market_id: str) -> Dict:
        """
        Get details for a specific market
        
        Args:
            market_id: Market identifier
        
        Returns:
            Market details
        """
        response = self._request('GET', f'/trading/markets/{market_id}')
        return response['data']
    
    def get_ticker(self, market_id: str) -> Dict:
        """
        Get ticker data for a market
        
        Args:
            market_id: Market identifier
        
        Returns:
            Ticker data
        """
        response = self._request('GET', f'/trading/markets/{market_id}/ticker')
        return response['data']
    
    def get_order_book(self, market_id: str, depth: int = 20) -> Dict:
        """
        Get order book for a market
        
        Args:
            market_id: Market identifier
            depth: Number of price levels (default: 20, max: 100)
        
        Returns:
            Order book with bids and asks
        """
        response = self._request(
            'GET',
            f'/trading/markets/{market_id}/orderbook',
            params={'depth': depth}
        )
        return response['data']
    
    def get_market_trades(self, market_id: str, limit: int = 50) -> List[Dict]:
        """
        Get recent trades for a market
        
        Args:
            market_id: Market identifier
            limit: Number of trades (default: 50, max: 100)
        
        Returns:
            List of trade objects
        """
        response = self._request(
            'GET',
            f'/trading/markets/{market_id}/trades',
            params={'limit': limit}
        )
        return response['data']
    
    # ==================== Orders ====================
    
    def place_order(
        self,
        market_id: str,
        side: str,
        order_type: str,
        quantity: str,
        price: Optional[str] = None,
        time_in_force: str = 'gtc',
        client_order_id: Optional[str] = None
    ) -> Dict:
        """
        Place a new order
        
        Args:
            market_id: Market identifier
            side: 'buy' or 'sell'
            order_type: 'limit' or 'market'
            quantity: Order quantity as string
            price: Limit price (required for limit orders)
            time_in_force: 'gtc', 'ioc', 'fok', or 'day'
            client_order_id: Optional client-specified ID
        
        Returns:
            Created order object
        """
        order_data = {
            'market_id': market_id,
            'side': side,
            'type': order_type,
            'quantity': quantity,
            'time_in_force': time_in_force
        }
        
        if price:
            order_data['price'] = price
        
        if client_order_id:
            order_data['client_order_id'] = client_order_id
        
        response = self._request('POST', '/trading/orders', data=order_data)
        return response['data']
    
    def list_orders(
        self,
        status: Optional[str] = None,
        market_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """
        List orders with optional filters
        
        Args:
            status: 'open', 'filled', 'cancelled', or 'all'
            market_id: Filter by market
            limit: Results per page (default: 50)
            offset: Pagination offset
        
        Returns:
            List of order objects
        """
        params = {'limit': limit, 'offset': offset}
        if status:
            params['status'] = status
        if market_id:
            params['market_id'] = market_id
        
        response = self._request('GET', '/trading/orders', params=params)
        return response['data']
    
    def get_order(self, order_id: str) -> Dict:
        """
        Get details for a specific order
        
        Args:
            order_id: Order identifier
        
        Returns:
            Order details
        """
        response = self._request('GET', f'/trading/orders/{order_id}')
        return response['data']
    
    def cancel_order(self, order_id: str) -> Dict:
        """
        Cancel an existing order
        
        Args:
            order_id: Order identifier
        
        Returns:
            Cancellation result
        """
        response = self._request('DELETE', f'/trading/orders/{order_id}')
        return response['data']
    
    def cancel_all_orders(self, market_id: Optional[str] = None) -> Dict:
        """
        Cancel all open orders (optionally filter by market)
        
        Args:
            market_id: Optional market filter
        
        Returns:
            Cancellation results
        """
        orders = self.list_orders(status='open', market_id=market_id)
        
        results = []
        for order in orders:
            try:
                result = self.cancel_order(order['order_id'])
                results.append({'success': True, 'order_id': order['order_id']})
            except Exception as e:
                results.append({
                    'success': False,
                    'order_id': order['order_id'],
                    'error': str(e)
                })
        
        return {
            'total': len(orders),
            'successful': len([r for r in results if r['success']]),
            'failed': len([r for r in results if not r['success']]),
            'results': results
        }
    
    # ==================== Trades ====================
    
    def get_trades(
        self,
        market_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get user trade history
        
        Args:
            market_id: Filter by market
            start_date: ISO 8601 start date
            end_date: ISO 8601 end date
            limit: Results per page
        
        Returns:
            List of trade objects
        """
        params = {'limit': limit}
        if market_id:
            params['market_id'] = market_id
        if start_date:
            params['start_date'] = start_date
        if end_date:
            params['end_date'] = end_date
        
        response = self._request('GET', '/trading/trades', params=params)
        return response['data']
    
    def get_trade(self, trade_id: str) -> Dict:
        """
        Get details for a specific trade
        
        Args:
            trade_id: Trade identifier
        
        Returns:
            Trade details
        """
        response = self._request('GET', f'/trading/trades/{trade_id}')
        return response['data']
    
    # ==================== Accounts ====================
    
    def get_trading_accounts(self) -> List[Dict]:
        """
        Get trading account balances
        
        Returns:
            List of account balance objects
        """
        response = self._request('GET', '/trading/trading-accounts')
        return response['data']
    
    def get_trading_account(self, account_id: str) -> Dict:
        """
        Get specific trading account
        
        Args:
            account_id: Account identifier
        
        Returns:
            Account details
        """
        response = self._request('GET', f'/trading/trading-accounts/{account_id}')
        return response['data']
    
    def get_currency_trading_accounts(self) -> List[Dict]:
        """
        Get currency trading accounts
        
        Returns:
            List of currency trading account objects
        """
        response = self._request('GET', '/trading/currency-trading-accounts')
        return response['data']
    
    # ==================== Positions ====================
    
    def get_positions(self, status: Optional[str] = None) -> List[Dict]:
        """
        Get user positions
        
        Args:
            status: Filter by status ('open' or 'closed')
        
        Returns:
            List of position objects
        """
        params = {}
        if status:
            params['filters[0][field]'] = 'status'
            params['filters[0][value]'] = status
        
        response = self._request('GET', '/positions', params=params)
        return response['data']
    
    # ==================== Price History ====================
    
    def get_price_history(
        self,
        market_id: str,
        resolution: str,
        from_timestamp: int,
        to_timestamp: int
    ) -> List[Dict]:
        """
        Get price history (OHLCV candles) for a market
        
        Args:
            market_id: Market identifier
            resolution: Candle resolution (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
            from_timestamp: Start time (Unix timestamp)
            to_timestamp: End time (Unix timestamp)
        
        Returns:
            List of price candle objects
        """
        params = {
            'filters[0][field]': 'market_id',
            'filters[0][value]': market_id,
            'filters[1][field]': 'resolution',
            'filters[1][value]': resolution,
            'filters[2][field]': 'from',
            'filters[2][value]': str(from_timestamp),
            'filters[3][field]': 'to',
            'filters[3][value]': str(to_timestamp),
            'order_by[]': 'period_start',
            'order_directions[]': 'asc'
        }
        
        response = self._request('GET', '/price_histories', params=params)
        return response['data']
    
    # ==================== Instruments ====================
    
    def list_instruments(self) -> List[Dict]:
        """
        List all instruments (public endpoint - no auth required)
        
        Returns:
            List of instrument objects
        """
        response = requests.get(f'{self.base_url}/instruments')
        response.raise_for_status()
        return response.json()['data']
    
    def get_instrument(self, instrument_id: str) -> Dict:
        """
        Get instrument details by ID
        
        Args:
            instrument_id: Instrument identifier
        
        Returns:
            Instrument details
        """
        response = requests.get(f'{self.base_url}/instruments/{instrument_id}')
        response.raise_for_status()
        return response.json()['data']
    
    def get_instrument_by_symbol(self, symbol: str) -> Dict:
        """
        Get instrument by symbol
        
        Args:
            symbol: Instrument symbol
        
        Returns:
            Instrument details
        """
        response = requests.get(f'{self.base_url}/instruments/by-symbol/{symbol}')
        response.raise_for_status()
        return response.json()['data']
    
    # ==================== Market Stats ====================
    
    def get_market_stats(self, market_id: str) -> Dict:
        """
        Get 24-hour market statistics
        
        Args:
            market_id: Market identifier
        
        Returns:
            Market statistics
        """
        response = self._request('GET', f'/markets/{market_id}/stats')
        return response['data']
    
    # ==================== Transfers ====================
    
    def transfer_to_consumption(self, instrument_id: str, quantity: int) -> Dict:
        """
        Transfer from trading to consumption account
        
        Args:
            instrument_id: Instrument to transfer
            quantity: Amount to transfer
        
        Returns:
            Transfer result with transfer_id
        """
        response = self._request(
            'POST',
            '/transfers/trading-to-consumption',
            data={'instrument_id': instrument_id, 'quantity': quantity}
        )
        return response
    
    def transfer_to_trading(self, instrument_id: str, quantity: int) -> Dict:
        """
        Transfer from consumption to trading account
        
        Args:
            instrument_id: Instrument to transfer
            quantity: Amount to transfer
        
        Returns:
            Transfer result with transfer_id
        """
        response = self._request(
            'POST',
            '/transfers/consumption-to-trading',
            data={'instrument_id': instrument_id, 'quantity': quantity}
        )
        return response
    
    def get_transfer_history(
        self,
        market_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """
        Get transfer history
        
        Args:
            market_id: Filter by market (optional)
            limit: Results per page
        
        Returns:
            List of transfer records
        """
        params = {'page_size': limit}
        if market_id:
            params['market_id'] = market_id
        
        response = self._request('GET', '/transfers/histories', params=params)
        return response['data']
    
    # ==================== Consumption ====================
    
    def get_consumption_instruments(self, api_key_id: Optional[str] = None) -> List[Dict]:
        """
        Get consumption instruments (balance and usage)
        
        Args:
            api_key_id: Filter by API key (optional)
        
        Returns:
            List of consumption instrument objects
        """
        params = {}
        if api_key_id:
            params['filters[0][field]'] = 'api_key_id'
            params['filters[0][value]'] = api_key_id
        
        response = self._request('GET', '/consumption/instruments', params=params)
        return response['data']
    
    # ==================== Public Data ====================
    
    def get_public_trades(self, market_id: str, limit: int = 50) -> List[Dict]:
        """
        Get public trades (no authentication required)
        
        Args:
            market_id: Filter by market
            limit: Results per page
        
        Returns:
            List of public trade objects
        """
        params = {
            'filters[0][field]': 'market_id',
            'filters[0][value]': market_id,
            'order_by[]': 'execution_timestamp',
            'order_directions[]': 'desc',
            'page_size': limit
        }
        
        response = requests.get(
            f'{self.base_url}/public_trades',
            params=params
        )
        response.raise_for_status()
        return response.json()['data']


# Example usage
if __name__ == '__main__':
    # Load keys from files
    with open('./ed25519.key', 'r') as f:
        private_key = f.read().strip()
    
    with open('./ed25519_pub.der', 'r') as f:
        public_key = f.read().strip()
    
    # Initialize client
    client = GridTradingClient(private_key, public_key)
    
    try:
        # Get markets
        markets = client.get_markets()
        print(f"Available markets: {len(markets)}")
        
        # Get balances
        balances = client.get_trading_accounts()
        print(f"Balances: {len(balances)} accounts")
        
        # Get positions
        positions = client.get_positions(status='open')
        print(f"Open positions: {len(positions)}")
        
        # List instruments
        instruments = client.list_instruments()
        ai_instruments = [i for i in instruments if i['instrument_type'] == 'ai_commodity']
        print(f"Available instruments: {len(instruments)} ({len(ai_instruments)} AI commodities)")
        
        # Get consumption balance
        consumption = client.get_consumption_instruments()
        if consumption:
            print(f"Consumption instruments: {len(consumption)}")
            for inst in consumption:
                usage_pct = (inst['tokens_used'] / inst['tokens_purchased']) * 100
                print(f"  {inst['instrument_name']}: {usage_pct:.1f}% used")
        
        # Get price history (last 24 hours, hourly candles)
        if markets:
            market_id = markets[0]['market_id']
            now = int(time.time())
            yesterday = now - (24 * 60 * 60)
            
            candles = client.get_price_history(market_id, '1h', yesterday, now)
            print(f"Price history: {len(candles)} hourly candles")
        
        # Place an order (commented out for safety)
        # order = client.place_order(
        #     market_id='market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
        #     side='buy',
        #     order_type='limit',
        #     quantity='0.01',
        #     price='45000.00'
        # )
        # print(f"Order placed: {order}")
        
    except requests.HTTPError as e:
        print(f"API Error: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"Error: {e}")

