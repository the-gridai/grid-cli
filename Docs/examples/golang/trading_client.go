// Package grid provides a complete client for the GRID Trading API
package grid

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// TradingClient is a complete client for GRID Trading API
type TradingClient struct {
	auth       *SignatureAuth
	baseURL    string
	httpClient *http.Client
}

// NewTradingClient creates a new trading client
//
// privateKey: Base64-encoded Ed25519 private key
// publicKey: Base64-encoded Ed25519 public key
// baseURL: API base URL (optional, defaults to dev environment)
func NewTradingClient(privateKey, publicKey string, baseURL ...string) (*TradingClient, error) {
	auth, err := NewSignatureAuth(privateKey, publicKey)
	if err != nil {
		return nil, err
	}

	url := "https://trading.api.thegrid.ai/v1"
	if len(baseURL) > 0 && baseURL[0] != "" {
		url = baseURL[0]
	}

	return &TradingClient{
		auth:    auth,
		baseURL: url,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// NewTradingClientFromFiles creates a client with keys loaded from files
func NewTradingClientFromFiles(privateKeyPath, publicKeyPath string, baseURL ...string) (*TradingClient, error) {
	auth, err := NewSignatureAuthFromFiles(privateKeyPath, publicKeyPath)
	if err != nil {
		return nil, err
	}

	url := "https://trading.api.thegrid.ai/v1"
	if len(baseURL) > 0 && baseURL[0] != "" {
		url = baseURL[0]
	}

	return &TradingClient{
		auth:    auth,
		baseURL: url,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// request makes an authenticated API request
func (c *TradingClient) request(method, path string, body interface{}, result interface{}) error {
	var bodyBytes []byte
	var err error

	if body != nil {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
	}

	bodyStr := ""
	if len(bodyBytes) > 0 {
		bodyStr = string(bodyBytes)
	}

	// Get authentication headers
	headers := c.auth.GetHeaders(method, path, bodyStr)

	// Create request
	fullURL := c.baseURL + path
	var bodyReader io.Reader
	if len(bodyBytes) > 0 {
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// Make request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode >= 400 {
		return fmt.Errorf("API error: %d - %s", resp.StatusCode, string(respBody))
	}

	// Unmarshal response
	if result != nil {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

// ==================== Markets ====================

// Market represents a trading market
type Market struct {
	ID             string `json:"id"`
	Symbol         string `json:"symbol"`
	BaseCurrency   string `json:"base_currency"`
	QuoteCurrency  string `json:"quote_currency"`
	MinOrderSize   string `json:"min_order_size"`
	MaxOrderSize   string `json:"max_order_size"`
	PriceIncrement string `json:"price_increment"`
	SizeIncrement  string `json:"size_increment"`
	Status         string `json:"status"`
	CreatedAt      string `json:"created_at"`
}

// GetMarkets lists all available markets
func (c *TradingClient) GetMarkets() ([]Market, error) {
	var response struct {
		Data []Market `json:"data"`
	}

	err := c.request("GET", "/trading/markets", nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

// GetMarket gets details for a specific market
func (c *TradingClient) GetMarket(marketID string) (*Market, error) {
	var response struct {
		Data Market `json:"data"`
	}

	path := fmt.Sprintf("/trading/markets/%s", marketID)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// Ticker represents market ticker data
type Ticker struct {
	MarketID              string `json:"market_id"`
	Symbol                string `json:"symbol"`
	LastPrice             string `json:"last_price"`
	Bid                   string `json:"bid"`
	Ask                   string `json:"ask"`
	Volume24h             string `json:"volume_24h"`
	High24h               string `json:"high_24h"`
	Low24h                string `json:"low_24h"`
	PriceChange24h        string `json:"price_change_24h"`
	PriceChangePercent24h string `json:"price_change_percent_24h"`
	Timestamp             string `json:"timestamp"`
}

// GetTicker gets ticker data for a market
func (c *TradingClient) GetTicker(marketID string) (*Ticker, error) {
	var response struct {
		Data Ticker `json:"data"`
	}

	path := fmt.Sprintf("/trading/markets/%s/ticker", marketID)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// OrderBook represents an order book
type OrderBook struct {
	MarketID  string     `json:"market_id"`
	Bids      [][]string `json:"bids"` // [price, quantity]
	Asks      [][]string `json:"asks"` // [price, quantity]
	Timestamp string     `json:"timestamp"`
}

// GetOrderBook gets the order book for a market
func (c *TradingClient) GetOrderBook(marketID string, depth int) (*OrderBook, error) {
	var response struct {
		Data OrderBook `json:"data"`
	}

	path := fmt.Sprintf("/trading/markets/%s/orderbook?depth=%d", marketID, depth)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// Trade represents a market trade
type Trade struct {
	TradeID   string `json:"trade_id"`
	MarketID  string `json:"market_id"`
	Price     string `json:"price"`
	Quantity  string `json:"quantity"`
	Side      string `json:"side"`
	Timestamp string `json:"timestamp"`
}

// GetMarketTrades gets recent trades for a market
func (c *TradingClient) GetMarketTrades(marketID string, limit int) ([]Trade, error) {
	var response struct {
		Data []Trade `json:"data"`
	}

	path := fmt.Sprintf("/trading/markets/%s/trades?limit=%d", marketID, limit)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

// ==================== Orders ====================

// Order represents a trading order
type Order struct {
	OrderID           string `json:"order_id"`
	ClientOrderID     string `json:"client_order_id,omitempty"`
	MarketID          string `json:"market_id"`
	Symbol            string `json:"symbol,omitempty"`
	Side              string `json:"side"`
	Type              string `json:"type"`
	Quantity          string `json:"quantity"`
	Price             string `json:"price,omitempty"`
	FilledQuantity    string `json:"filled_quantity,omitempty"`
	RemainingQuantity string `json:"remaining_quantity,omitempty"`
	Status            string `json:"status"`
	TimeInForce       string `json:"time_in_force,omitempty"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at,omitempty"`
}

// PlaceOrderRequest represents an order placement request
type PlaceOrderRequest struct {
	MarketID      string `json:"market_id"`
	Side          string `json:"side"`
	Type          string `json:"type"`
	Quantity      string `json:"quantity"`
	Price         string `json:"price,omitempty"`
	TimeInForce   string `json:"time_in_force,omitempty"`
	ClientOrderID string `json:"client_order_id,omitempty"`
}

// PlaceOrder places a new order
func (c *TradingClient) PlaceOrder(req PlaceOrderRequest) (*Order, error) {
	var response struct {
		Data Order `json:"data"`
	}

	err := c.request("POST", "/trading/orders", req, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// ListOrdersParams represents parameters for listing orders
type ListOrdersParams struct {
	Status   string
	MarketID string
	Limit    int
	Offset   int
}

// ListOrders lists orders with optional filters
func (c *TradingClient) ListOrders(params ListOrdersParams) ([]Order, error) {
	var response struct {
		Data []Order `json:"data"`
	}

	// Build query string
	query := url.Values{}
	if params.Status != "" {
		query.Set("status", params.Status)
	}
	if params.MarketID != "" {
		query.Set("market_id", params.MarketID)
	}
	if params.Limit > 0 {
		query.Set("limit", strconv.Itoa(params.Limit))
	}
	if params.Offset > 0 {
		query.Set("offset", strconv.Itoa(params.Offset))
	}

	path := "/trading/orders"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}

	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

// GetOrder gets details for a specific order
func (c *TradingClient) GetOrder(orderID string) (*Order, error) {
	var response struct {
		Data Order `json:"data"`
	}

	path := fmt.Sprintf("/trading/orders/%s", orderID)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// CancelOrder cancels an existing order
func (c *TradingClient) CancelOrder(orderID string) error {
	path := fmt.Sprintf("/trading/orders/%s", orderID)
	return c.request("DELETE", path, nil, nil)
}

// CancelAllOrdersResult represents the result of cancelling all orders
type CancelAllOrdersResult struct {
	Total      int      `json:"total"`
	Successful int      `json:"successful"`
	Failed     int      `json:"failed"`
	Errors     []string `json:"errors,omitempty"`
}

// CancelAllOrders cancels all open orders (optionally filter by market)
func (c *TradingClient) CancelAllOrders(marketID string) (*CancelAllOrdersResult, error) {
	params := ListOrdersParams{
		Status:   "open",
		MarketID: marketID,
	}

	orders, err := c.ListOrders(params)
	if err != nil {
		return nil, err
	}

	result := &CancelAllOrdersResult{
		Total: len(orders),
	}

	for _, order := range orders {
		if err := c.CancelOrder(order.OrderID); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to cancel %s: %v", order.OrderID, err))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// ==================== Trades ====================

// UserTrade represents a user's trade execution
type UserTrade struct {
	TradeID     string `json:"trade_id"`
	OrderID     string `json:"order_id"`
	MarketID    string `json:"market_id"`
	Symbol      string `json:"symbol,omitempty"`
	Side        string `json:"side"`
	Quantity    string `json:"quantity"`
	Price       string `json:"price"`
	Fee         string `json:"fee"`
	FeeCurrency string `json:"fee_currency"`
	Role        string `json:"role"`
	Timestamp   string `json:"timestamp"`
}

// GetTradesParams represents parameters for getting trade history
type GetTradesParams struct {
	MarketID  string
	StartDate string
	EndDate   string
	Limit     int
	Offset    int
}

// GetTrades gets user trade history
func (c *TradingClient) GetTrades(params GetTradesParams) ([]UserTrade, error) {
	var response struct {
		Data []UserTrade `json:"data"`
	}

	// Build query string
	query := url.Values{}
	if params.MarketID != "" {
		query.Set("market_id", params.MarketID)
	}
	if params.StartDate != "" {
		query.Set("start_date", params.StartDate)
	}
	if params.EndDate != "" {
		query.Set("end_date", params.EndDate)
	}
	if params.Limit > 0 {
		query.Set("limit", strconv.Itoa(params.Limit))
	}
	if params.Offset > 0 {
		query.Set("offset", strconv.Itoa(params.Offset))
	}

	path := "/trading/trades"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}

	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

// GetTrade gets details for a specific trade
func (c *TradingClient) GetTrade(tradeID string) (*UserTrade, error) {
	var response struct {
		Data UserTrade `json:"data"`
	}

	path := fmt.Sprintf("/trading/trades/%s", tradeID)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// ==================== Accounts ====================

// TradingAccount represents a trading account balance
type TradingAccount struct {
	AccountID string `json:"account_id"`
	Currency  string `json:"currency"`
	Available string `json:"available"`
	Reserved  string `json:"reserved"`
	Total     string `json:"total"`
	UpdatedAt string `json:"updated_at"`
}

// GetTradingAccounts gets trading account balances
func (c *TradingClient) GetTradingAccounts() ([]TradingAccount, error) {
	var response struct {
		Data []TradingAccount `json:"data"`
	}

	err := c.request("GET", "/trading/trading-accounts", nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

// GetTradingAccount gets a specific trading account
func (c *TradingClient) GetTradingAccount(accountID string) (*TradingAccount, error) {
	var response struct {
		Data TradingAccount `json:"data"`
	}

	path := fmt.Sprintf("/trading/trading-accounts/%s", accountID)
	err := c.request("GET", path, nil, &response)
	if err != nil {
		return nil, err
	}

	return &response.Data, nil
}

// GetCurrencyTradingAccounts gets currency trading accounts
func (c *TradingClient) GetCurrencyTradingAccounts() ([]TradingAccount, error) {
	var response struct {
		Data []TradingAccount `json:"data"`
	}

	err := c.request("GET", "/trading/currency-trading-accounts", nil, &response)
	if err != nil {
		return nil, err
	}

	return response.Data, nil
}

