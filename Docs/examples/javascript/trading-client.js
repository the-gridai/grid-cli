/**
 * GRID Trading API Client (JavaScript/TypeScript)
 * 
 * Complete client for interacting with the GRID Trading API
 */

const axios = require('axios');
const { SignatureAuth } = require('./auth');

class GridTradingClient {
  /**
   * Initialize the trading client
   * 
   * @param {string} privateKey - Base64-encoded Ed25519 private key
   * @param {string} publicKey - Base64-encoded Ed25519 public key
   * @param {Object} options - Optional configuration
   * @param {string} options.baseUrl - API base URL
   */
  constructor(privateKey, publicKey, options = {}) {
    this.auth = new SignatureAuth(privateKey, publicKey);
    this.baseUrl = options.baseUrl || 'https://trading.api.thegrid.ai/v1';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Make an authenticated API request
   * 
   * @private
   */
  async _request(method, path, data = null) {
    const body = data ? JSON.stringify(data) : '';
    const headers = this.auth.getHeaders(method, path, body);
    
    const config = {
      method,
      url: path,
      headers,
      ...(data && { data })
    };
    
    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // ==================== Markets ====================

  /**
   * List all available markets
   * 
   * @returns {Promise<Array>} Array of market objects
   */
  async getMarkets() {
    const response = await this._request('GET', '/trading/markets');
    return response.data;
  }

  /**
   * Get details for a specific market
   * 
   * @param {string} marketId - Market identifier
   * @returns {Promise<Object>} Market details
   */
  async getMarket(marketId) {
    const response = await this._request('GET', `/trading/markets/${marketId}`);
    return response.data;
  }

  /**
   * Get ticker data for a market
   * 
   * @param {string} marketId - Market identifier
   * @returns {Promise<Object>} Ticker data
   */
  async getTicker(marketId) {
    const response = await this._request('GET', `/trading/markets/${marketId}/ticker`);
    return response.data;
  }

  /**
   * Get order book for a market
   * 
   * @param {string} marketId - Market identifier
   * @param {number} depth - Number of price levels (default: 20, max: 100)
   * @returns {Promise<Object>} Order book with bids and asks
   */
  async getOrderBook(marketId, depth = 20) {
    const response = await this._request('GET', `/trading/markets/${marketId}/orderbook?depth=${depth}`);
    return response.data;
  }

  /**
   * Get recent trades for a market
   * 
   * @param {string} marketId - Market identifier
   * @param {number} limit - Number of trades (default: 50, max: 100)
   * @returns {Promise<Array>} Array of trade objects
   */
  async getMarketTrades(marketId, limit = 50) {
    const response = await this._request('GET', `/trading/markets/${marketId}/trades?limit=${limit}`);
    return response.data;
  }

  // ==================== Orders ====================

  /**
   * Place a new order
   * 
   * @param {Object} order - Order parameters
   * @param {string} order.market_id - Market identifier
   * @param {string} order.side - 'buy' or 'sell'
   * @param {string} order.type - 'limit' or 'market'
   * @param {string} order.quantity - Order quantity as string
   * @param {string} order.price - Limit price (required for limit orders)
   * @param {string} order.time_in_force - 'gtc', 'ioc', 'fok', or 'day'
   * @param {string} order.client_order_id - Optional client-specified ID
   * @returns {Promise<Object>} Created order object
   */
  async placeOrder(order) {
    const response = await this._request('POST', '/trading/orders', order);
    return response.data;
  }

  /**
   * List orders with optional filters
   * 
   * @param {Object} filters - Filter parameters
   * @param {string} filters.status - 'open', 'filled', 'cancelled', or 'all'
   * @param {string} filters.market_id - Filter by market
   * @param {number} filters.limit - Results per page (default: 50)
   * @param {number} filters.offset - Pagination offset
   * @returns {Promise<Array>} Array of order objects
   */
  async listOrders(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const path = `/trading/orders${queryString ? '?' + queryString : ''}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  /**
   * Get details for a specific order
   * 
   * @param {string} orderId - Order identifier
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    const response = await this._request('GET', `/trading/orders/${orderId}`);
    return response.data;
  }

  /**
   * Cancel an existing order
   * 
   * @param {string} orderId - Order identifier
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelOrder(orderId) {
    const response = await this._request('DELETE', `/trading/orders/${orderId}`);
    return response.data;
  }

  /**
   * Cancel all open orders (optionally filter by market)
   * 
   * @param {string} marketId - Optional market filter
   * @returns {Promise<Object>} Cancellation results
   */
  async cancelAllOrders(marketId = null) {
    const filters = { status: 'open' };
    if (marketId) filters.market_id = marketId;
    
    const orders = await this.listOrders(filters);
    const cancelPromises = orders.map(order => 
      this.cancelOrder(order.order_id).catch(err => ({
        error: true,
        orderId: order.order_id,
        message: err.message
      }))
    );
    
    const results = await Promise.all(cancelPromises);
    return {
      total: orders.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results
    };
  }

  // ==================== Trades ====================

  /**
   * Get user trade history
   * 
   * @param {Object} filters - Filter parameters
   * @param {string} filters.market_id - Filter by market
   * @param {string} filters.start_date - ISO 8601 start date
   * @param {string} filters.end_date - ISO 8601 end date
   * @param {number} filters.limit - Results per page
   * @returns {Promise<Array>} Array of trade objects
   */
  async getTrades(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    const path = `/trading/trades${queryString ? '?' + queryString : ''}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  /**
   * Get details for a specific trade
   * 
   * @param {string} tradeId - Trade identifier
   * @returns {Promise<Object>} Trade details
   */
  async getTrade(tradeId) {
    const response = await this._request('GET', `/trading/trades/${tradeId}`);
    return response.data;
  }

  // ==================== Accounts ====================

  /**
   * Get trading account balances
   * 
   * @returns {Promise<Array>} Array of account balance objects
   */
  async getTradingAccounts() {
    const response = await this._request('GET', '/trading/trading-accounts');
    return response.data;
  }

  /**
   * Get specific trading account
   * 
   * @param {string} accountId - Account identifier
   * @returns {Promise<Object>} Account details
   */
  async getTradingAccount(accountId) {
    const response = await this._request('GET', `/trading/trading-accounts/${accountId}`);
    return response.data;
  }

  /**
   * Get currency trading accounts
   * 
   * @returns {Promise<Array>} Currency trading account objects
   */
  async getCurrencyTradingAccounts() {
    const response = await this._request('GET', '/trading/currency-trading-accounts');
    return response.data;
  }

  // ==================== Positions ====================

  /**
   * Get user positions
   * 
   * @param {Object} filters - Filter parameters
   * @param {string} filters.status - Filter by status ('open' or 'closed')
   * @returns {Promise<Array>} Array of position objects
   */
  async getPositions(filters = {}) {
    const params = {};
    let filterIdx = 0;
    
    if (filters.status) {
      params[`filters[${filterIdx}][field]`] = 'status';
      params[`filters[${filterIdx}][value]`] = filters.status;
    }
    
    const queryString = new URLSearchParams(params).toString();
    const path = `/positions${queryString ? '?' + queryString : ''}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  // ==================== Price History ====================

  /**
   * Get price history (OHLCV candles) for a market
   * 
   * @param {string} marketId - Market identifier
   * @param {string} resolution - Candle resolution (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
   * @param {number} fromTimestamp - Start time (Unix timestamp)
   * @param {number} toTimestamp - End time (Unix timestamp)
   * @returns {Promise<Array>} Array of price candles
   */
  async getPriceHistory(marketId, resolution, fromTimestamp, toTimestamp) {
    const params = {
      'filters[0][field]': 'market_id',
      'filters[0][value]': marketId,
      'filters[1][field]': 'resolution',
      'filters[1][value]': resolution,
      'filters[2][field]': 'from',
      'filters[2][value]': fromTimestamp.toString(),
      'filters[3][field]': 'to',
      'filters[3][value]': toTimestamp.toString(),
      'order_by[]': 'period_start',
      'order_directions[]': 'asc'
    };
    
    const queryString = new URLSearchParams(params).toString();
    const path = `/price_histories?${queryString}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  // ==================== Instruments ====================

  /**
   * List all instruments (public endpoint - no auth required)
   * 
   * @returns {Promise<Array>} Array of instrument objects
   */
  async listInstruments() {
    try {
      const response = await axios.get(`${this.baseUrl}/instruments`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to list instruments: ${error.message}`);
    }
  }

  /**
   * Get instrument details by ID
   * 
   * @param {string} instrumentId - Instrument identifier
   * @returns {Promise<Object>} Instrument details
   */
  async getInstrument(instrumentId) {
    try {
      const response = await axios.get(`${this.baseUrl}/instruments/${instrumentId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get instrument: ${error.message}`);
    }
  }

  /**
   * Get instrument by symbol
   * 
   * @param {string} symbol - Instrument symbol
   * @returns {Promise<Object>} Instrument details
   */
  async getInstrumentBySymbol(symbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/instruments/by-symbol/${symbol}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get instrument by symbol: ${error.message}`);
    }
  }

  // ==================== Market Stats ====================

  /**
   * Get 24-hour market statistics
   * 
   * @param {string} marketId - Market identifier
   * @returns {Promise<Object>} Market statistics
   */
  async getMarketStats(marketId) {
    const response = await this._request('GET', `/markets/${marketId}/stats`);
    return response.data;
  }

  // ==================== Transfers ====================

  /**
   * Transfer from trading to consumption account
   * 
   * @param {string} instrumentId - Instrument to transfer
   * @param {number} quantity - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  async transferToConsumption(instrumentId, quantity) {
    const response = await this._request('POST', '/transfers/trading-to-consumption', {
      instrument_id: instrumentId,
      quantity: quantity
    });
    return response;
  }

  /**
   * Transfer from consumption to trading account
   * 
   * @param {string} instrumentId - Instrument to transfer
   * @param {number} quantity - Amount to transfer
   * @returns {Promise<Object>} Transfer result
   */
  async transferToTrading(instrumentId, quantity) {
    const response = await this._request('POST', '/transfers/consumption-to-trading', {
      instrument_id: instrumentId,
      quantity: quantity
    });
    return response;
  }

  /**
   * Get transfer history
   * 
   * @param {string} marketId - Filter by market (optional)
   * @param {number} limit - Results per page
   * @returns {Promise<Array>} Transfer history
   */
  async getTransferHistory(marketId = null, limit = 50) {
    const params = { page_size: limit };
    if (marketId) params.market_id = marketId;
    
    const queryString = new URLSearchParams(params).toString();
    const path = `/transfers/histories?${queryString}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  // ==================== Consumption ====================

  /**
   * Get consumption instruments (balance and usage)
   * 
   * @param {string} apiKeyId - Filter by API key (optional)
   * @returns {Promise<Array>} Consumption instruments
   */
  async getConsumptionInstruments(apiKeyId = null) {
    const params = {};
    if (apiKeyId) {
      params['filters[0][field]'] = 'api_key_id';
      params['filters[0][value]'] = apiKeyId;
    }
    
    const queryString = new URLSearchParams(params).toString();
    const path = `/consumption/instruments${queryString ? '?' + queryString : ''}`;
    const response = await this._request('GET', path);
    return response.data;
  }

  // ==================== Public Data ====================

  /**
   * Get public trades (no authentication required)
   * 
   * @param {string} marketId - Filter by market
   * @param {number} limit - Results per page
   * @returns {Promise<Array>} Public trades
   */
  async getPublicTrades(marketId, limit = 50) {
    const params = {
      'filters[0][field]': 'market_id',
      'filters[0][value]': marketId,
      'order_by[]': 'execution_timestamp',
      'order_directions[]': 'desc',
      'page_size': limit
    };
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/public_trades`,
        { params }
      );
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get public trades: ${error.message}`);
    }
  }
}

module.exports = { GridTradingClient };

// Example usage:
if (require.main === module) {
  const fs = require('fs');
  
  // Load keys from files
  const privateKey = fs.readFileSync('./ed25519.key', 'utf8').trim();
  const publicKey = fs.readFileSync('./ed25519_pub.der', 'utf8').trim();
  
  const client = new GridTradingClient(privateKey, publicKey);
  
  (async () => {
    try {
      // Get markets
      const markets = await client.getMarkets();
      console.log('Available markets:', markets.length);
      
      // Get balances
      const balances = await client.getTradingAccounts();
      console.log('Balances:', balances);
      
      // Place an order
      // const order = await client.placeOrder({
      //   market_id: 'market_b310e860-97cd-45eb-bdc3-5be0b79295d0',
      //   side: 'buy',
      //   type: 'limit',
      //   quantity: '0.01',
      //   price: '45000.00',
      //   time_in_force: 'gtc'
      // });
      // console.log('Order placed:', order);
      
    } catch (error) {
      console.error('Error:', error.message);
    }
  })();
}

