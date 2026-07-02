# grid/Makefile - Multi-language build orchestration
# Works for TypeScript now, Python/Go SDKs later

.PHONY: all build test clean lint sdk-ts-build sdk-ts-test sdk-ts-lint mock-build mock-test mock-start

all: build test

# ============================================================================
# TypeScript SDK
# ============================================================================

sdk-ts-install:
	cd packages/sdk-typescript && npm ci

sdk-ts-build: sdk-ts-install
	cd packages/sdk-typescript && npm run build

sdk-ts-test:
	cd packages/sdk-typescript && npm test

sdk-ts-lint:
	cd packages/sdk-typescript && npm run lint

sdk-ts-clean:
	rm -rf packages/sdk-typescript/dist packages/sdk-typescript/node_modules

# ============================================================================
# Mock Server
# ============================================================================

mock-install:
	cd mock-server && npm ci

mock-build: mock-install
	cd mock-server && npm run build

mock-test:
	cd mock-server && npm test

mock-start:
	cd mock-server && npm start

mock-clean:
	rm -rf mock-server/dist mock-server/node_modules

# ============================================================================
# Future: Python SDK
# ============================================================================
# sdk-py-install:
# 	cd packages/sdk-python && pip install -e ".[dev]"
#
# sdk-py-build:
# 	cd packages/sdk-python && python -m build
#
# sdk-py-test:
# 	cd packages/sdk-python && pytest
#
# sdk-py-lint:
# 	cd packages/sdk-python && ruff check .

# ============================================================================
# Future: Go SDK
# ============================================================================
# sdk-go-build:
# 	cd packages/sdk-go && go build ./...
#
# sdk-go-test:
# 	cd packages/sdk-go && go test ./...
#
# sdk-go-lint:
# 	cd packages/sdk-go && golangci-lint run

# ============================================================================
# Aggregate Targets
# ============================================================================

build: sdk-ts-build mock-build
test: sdk-ts-test mock-test
lint: sdk-ts-lint
clean: sdk-ts-clean mock-clean

# CI target - full build and test
ci: lint build test
