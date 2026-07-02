// Example usage of the GRID Trading API client
//
// This file demonstrates how to use the trading client
package main

import (
	"fmt"
	"log"

	grid "." // Import the grid package
)

func main() {
	// Option 1: Load keys from files
	client, err := grid.NewTradingClientFromFiles(
		"./ed25519.key",
		"./ed25519_pub.der",
	)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	// Option 2: Initialize with key strings
	// privateKey := "your_base64_encoded_private_key"
	// publicKey := "your_base64_encoded_public_key"
	// client, err := grid.NewTradingClient(privateKey, publicKey)

	// Get all markets
	fmt.Println("Fetching markets...")
	markets, err := client.GetMarkets()
	if err != nil {
		log.Fatalf("Failed to get markets: %v", err)
	}

	fmt.Printf("Available markets: %d\n", len(markets))
	for _, market := range markets {
		fmt.Printf("  - %s (%s)\n", market.Symbol, market.ID)
	}

	if len(markets) == 0 {
		return
	}

	// Get ticker for first market
	marketID := markets[0].ID
	fmt.Printf("\nFetching ticker for %s...\n", markets[0].Symbol)
	ticker, err := client.GetTicker(marketID)
	if err != nil {
		log.Fatalf("Failed to get ticker: %v", err)
	}

	fmt.Printf("Last price: %s\n", ticker.LastPrice)
	fmt.Printf("24h change: %s%%\n", ticker.PriceChangePercent24h)

	// Get order book
	fmt.Printf("\nFetching order book for %s...\n", markets[0].Symbol)
	orderBook, err := client.GetOrderBook(marketID, 5)
	if err != nil {
		log.Fatalf("Failed to get order book: %v", err)
	}

	fmt.Println("Top 5 Bids:")
	for _, bid := range orderBook.Bids {
		if len(bid) >= 2 {
			fmt.Printf("  %s @ %s\n", bid[1], bid[0])
		}
	}

	fmt.Println("Top 5 Asks:")
	for _, ask := range orderBook.Asks {
		if len(ask) >= 2 {
			fmt.Printf("  %s @ %s\n", ask[1], ask[0])
		}
	}

	// Get trading accounts (balances)
	fmt.Println("\nFetching trading accounts...")
	accounts, err := client.GetTradingAccounts()
	if err != nil {
		log.Fatalf("Failed to get trading accounts: %v", err)
	}

	fmt.Println("Balances:")
	for _, account := range accounts {
		fmt.Printf("  %s: %s available, %s reserved\n",
			account.Currency,
			account.Available,
			account.Reserved,
		)
	}

	// Place an order (commented out for safety)
	// fmt.Println("\nPlacing order...")
	// order, err := client.PlaceOrder(grid.PlaceOrderRequest{
	// 	MarketID:    marketID,
	// 	Side:        "buy",
	// 	Type:        "limit",
	// 	Quantity:    "0.01",
	// 	Price:       "45000.00",
	// 	TimeInForce: "gtc",
	// })
	// if err != nil {
	// 	log.Fatalf("Failed to place order: %v", err)
	// }
	// fmt.Printf("Order placed: %s\n", order.OrderID)

	// List open orders
	fmt.Println("\nFetching open orders...")
	orders, err := client.ListOrders(grid.ListOrdersParams{
		Status: "open",
		Limit:  10,
	})
	if err != nil {
		log.Fatalf("Failed to list orders: %v", err)
	}

	fmt.Printf("Open orders: %d\n", len(orders))
	for _, order := range orders {
		fmt.Printf("  %s: %s %s %s @ %s\n",
			order.OrderID,
			order.Side,
			order.Quantity,
			order.Symbol,
			order.Price,
		)
	}

	// Get trade history
	fmt.Println("\nFetching trade history...")
	trades, err := client.GetTrades(grid.GetTradesParams{
		Limit: 10,
	})
	if err != nil {
		log.Fatalf("Failed to get trades: %v", err)
	}

	fmt.Printf("Recent trades: %d\n", len(trades))
	for _, trade := range trades {
		fmt.Printf("  %s: %s %s @ %s (fee: %s %s)\n",
			trade.TradeID,
			trade.Side,
			trade.Quantity,
			trade.Price,
			trade.Fee,
			trade.FeeCurrency,
		)
	}

	fmt.Println("\nDone!")
}

