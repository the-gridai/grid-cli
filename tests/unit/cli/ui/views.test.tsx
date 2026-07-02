import React from 'react';
import { render } from 'ink-testing-library';
import {
  StatusView,
  BalanceView,
  OrderListView,
  ActionFeedbackView,
  ProfileListView,
  ProfileDetailView,
  AuthStatusView,
  AuthLoginView,
  SupplyListView,
  SupplySummaryView,
  StrategyListView,
} from '../../../../src/cli/ui/views';
import type { ProfileInfo, ProfileDetailData } from '../../../../src/cli/ui/views';
import type { AuthStatusData, ConnectionStatus } from '../../../../src/cli/ui/views';
import type { SupplyIssuance, SupplySummaryItem, SupplySummaryTotals } from '../../../../src/cli/ui/views';
import type { StrategyInfo } from '../../../../src/cli/ui/views';

describe('View Components', () => {
  describe('StatusView', () => {
    it('should render with all required props', () => {
      const { lastFrame } = render(
        <StatusView
          apiUrl="https://api.thegrid.ai"
          wsUrl="wss://ws.thegrid.ai"
          dbHost="localhost"
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('THE GRID_');
      expect(frame).toContain('https://api.thegrid.ai');
      expect(frame).toContain('localhost');
    });

    it('should show profile name', () => {
      const { lastFrame } = render(
        <StatusView
          apiUrl="https://api.thegrid.ai"
          wsUrl="wss://ws.thegrid.ai"
          dbHost="localhost"
          profile="production"
        />
      );
      expect(lastFrame()).toContain('production');
    });

    it('should show online status', () => {
      const { lastFrame } = render(
        <StatusView
          apiUrl="https://api.thegrid.ai"
          wsUrl="wss://ws.thegrid.ai"
          dbHost="localhost"
          isOnline={true}
        />
      );
      expect(lastFrame()).toContain('Connected');
    });

    it('should show offline status', () => {
      const { lastFrame } = render(
        <StatusView
          apiUrl="https://api.thegrid.ai"
          wsUrl="wss://ws.thegrid.ai"
          dbHost="localhost"
          isOnline={false}
        />
      );
      expect(lastFrame()).toContain('Offline');
    });
  });

  describe('BalanceView', () => {
    it('should render empty state', () => {
      const { lastFrame } = render(<BalanceView balances={[]} />);
      expect(lastFrame()).toContain('No trading accounts found');
    });

    it('should render balances table', () => {
      const { lastFrame } = render(
        <BalanceView
          balances={[
            { instrument: 'BTC', available: '1.5', locked: '0.5', total: '2.0' },
            { instrument: 'ETH', available: '10.0', locked: '0.0', total: '10.0' },
          ]}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('BALANCES');
      expect(frame).toContain('BTC');
      expect(frame).toContain('ETH');
      expect(frame).toContain('1.5');
      expect(frame).toContain('Total accounts: 2');
    });

    it('should render loading state', () => {
      const { lastFrame } = render(<BalanceView balances={[]} loading={true} />);
      expect(lastFrame()).toContain('Fetching balances');
    });

    it('should render error state', () => {
      const { lastFrame } = render(
        <BalanceView balances={[]} error="Connection failed" />
      );
      expect(lastFrame()).toContain('Connection failed');
    });
  });

  describe('OrderListView', () => {
    it('should render empty state', () => {
      const { lastFrame } = render(<OrderListView orders={[]} />);
      expect(lastFrame()).toContain('No orders found');
    });

    it('should render orders table', () => {
      const { lastFrame } = render(
        <OrderListView
          orders={[
            { id: 'order_123', side: 'buy', size: '100', price: '50.00', status: 'open' },
            { id: 'order_456', side: 'sell', size: '200', price: '55.00', status: 'filled' },
          ]}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('ORDERS');
      expect(frame).toContain('order_123');
      expect(frame).toContain('buy');
      expect(frame).toContain('sell');
      expect(frame).toContain('OPEN');
      expect(frame).toContain('FILLED');
    });

    it('should show source information', () => {
      const { lastFrame } = render(
        <OrderListView orders={[]} source="api" />
      );
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('ActionFeedbackView', () => {
    it('should render pending state with spinner', () => {
      const { lastFrame } = render(
        <ActionFeedbackView title="Creating order..." status="pending" />
      );
      expect(lastFrame()).toContain('Creating order');
    });

    it('should render success state', () => {
      const { lastFrame } = render(
        <ActionFeedbackView title="Order Created" status="success" />
      );
      expect(lastFrame()).toContain('Order Created');
    });

    it('should render error state with message', () => {
      const { lastFrame } = render(
        <ActionFeedbackView
          title="Order Failed"
          status="error"
          error="Insufficient balance"
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('Order Failed');
      expect(frame).toContain('Insufficient balance');
    });

    it('should render with details', () => {
      const { lastFrame } = render(
        <ActionFeedbackView
          title="Order Created"
          status="success"
          details={[
            { label: 'Order ID', value: 'order_123' },
            { label: 'Status', value: 'open' },
          ]}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('Order ID');
      expect(frame).toContain('order_123');
      expect(frame).toContain('Status');
    });

    it('should render with message', () => {
      const { lastFrame } = render(
        <ActionFeedbackView
          title="Success"
          status="success"
          message="Operation completed successfully"
        />
      );
      expect(lastFrame()).toContain('Operation completed successfully');
    });
  });

  describe('ProfileListView', () => {
    const profiles: ProfileInfo[] = [
      { name: 'dev', description: 'Development', apiUrl: 'http://localhost:4040', hasCredentials: true, isCurrent: true, isActive: true },
      { name: 'prod', description: 'Production', apiUrl: 'https://api.thegrid.ai', hasCredentials: true, isCurrent: false, isActive: false },
    ];

    it('should render empty state', () => {
      const { lastFrame } = render(
        <ProfileListView profiles={[]} credentialsPath="/path/to/creds.json" />
      );
      const frame = lastFrame();
      expect(frame).toContain('No profiles configured');
      expect(frame).toContain('grid profile set');
    });

    it('should render profiles table', () => {
      const { lastFrame } = render(
        <ProfileListView
          profiles={profiles}
          activeProfile="dev"
          credentialsPath="/path/to/creds.json"
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('PROFILES');
      expect(frame).toContain('dev');
      expect(frame).toContain('prod');
      expect(frame).toContain('Development');
      expect(frame).toContain('(default)');
    });

    it('should show active profile indicator', () => {
      const { lastFrame } = render(
        <ProfileListView
          profiles={profiles}
          activeProfile="dev"
          credentialsPath="/path/to/creds.json"
        />
      );
      expect(lastFrame()).toContain('▶');
    });

    it('should show credentials path', () => {
      const { lastFrame } = render(
        <ProfileListView
          profiles={profiles}
          credentialsPath="/home/user/.grid-cli/credentials.json"
        />
      );
      expect(lastFrame()).toContain('/home/user/.grid-cli/credentials.json');
    });
  });

  describe('ProfileDetailView', () => {
    const profile: ProfileDetailData = {
      name: 'dev',
      description: 'Development environment',
      apiUrl: 'http://localhost:4040',
      wsUrl: 'ws://localhost:4040',
      signingKey: 'secret-key-12345',
      fingerprint: 'abc123def456',
      apiKey: undefined,
    };

    it('should render profile details', () => {
      const { lastFrame } = render(
        <ProfileDetailView
          profile={profile}
          profileName="dev"
          credentialsPath="/path/to/creds.json"
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('PROFILE: DEV');
      expect(frame).toContain('Development environment');
      expect(frame).toContain('http://localhost:4040');
    });

    it('should mask secrets by default', () => {
      const { lastFrame } = render(
        <ProfileDetailView
          profile={profile}
          profileName="dev"
          credentialsPath="/path/to/creds.json"
          showSecrets={false}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('secr...2345');
      expect(frame).not.toContain('secret-key-12345');
    });

    it('should show secrets when requested', () => {
      const { lastFrame } = render(
        <ProfileDetailView
          profile={profile}
          profileName="dev"
          credentialsPath="/path/to/creds.json"
          showSecrets={true}
        />
      );
      expect(lastFrame()).toContain('secret-key-12345');
    });

    it('should render error when profile not found', () => {
      const { lastFrame } = render(
        <ProfileDetailView
          profile={null}
          profileName="nonexistent"
          credentialsPath="/path/to/creds.json"
          error="Profile 'nonexistent' not found."
        />
      );
      const frame = lastFrame();
      expect(frame).toContain("Profile 'nonexistent' not found");
    });
  });

  describe('AuthStatusView', () => {
    const authData: AuthStatusData = {
      credentialsFileFound: true,
      credentialsPath: '/path/to/creds.json',
      activeProfile: 'dev',
      credentialsFrom: 'profile',
      apiUrl: 'http://localhost:4040',
      signingKeyConfigured: true,
      fingerprintConfigured: true,
      signingKeyMasked: 'secr...1234',
      fingerprintMasked: 'abc1...5678',
    };

    const connectionSuccess: ConnectionStatus = {
      status: 'success',
      accountCount: 3,
    };

    const connectionError: ConnectionStatus = {
      status: 'error',
      message: 'Connection refused',
    };

    it('should render auth status', () => {
      const { lastFrame } = render(
        <AuthStatusView auth={authData} connection={connectionSuccess} />
      );
      const frame = lastFrame();
      expect(frame).toContain('AUTHENTICATION STATUS');
      expect(frame).toContain('Found');
      expect(frame).toContain('dev');
      expect(frame).toContain('Profile');
    });

    it('should show connection success', () => {
      const { lastFrame } = render(
        <AuthStatusView auth={authData} connection={connectionSuccess} />
      );
      const frame = lastFrame();
      expect(frame).toContain('Authenticated');
      expect(frame).toContain('Trading accounts');
    });

    it('should show connection error', () => {
      const { lastFrame } = render(
        <AuthStatusView auth={authData} connection={connectionError} />
      );
      expect(lastFrame()).toContain('Connection refused');
    });

    it('should show pending connection', () => {
      const { lastFrame } = render(
        <AuthStatusView
          auth={authData}
          connection={{ status: 'pending' }}
        />
      );
      expect(lastFrame()).toContain('Testing connection');
    });

    it('should show skipped connection', () => {
      const { lastFrame } = render(
        <AuthStatusView
          auth={{ ...authData, signingKeyConfigured: false }}
          connection={{ status: 'skipped' }}
        />
      );
      expect(lastFrame()).toContain('Skipped');
    });
  });

  describe('AuthLoginView', () => {
    it('should render setup instructions', () => {
      const { lastFrame } = render(
        <AuthLoginView credentialsPath="/path/to/creds.json" />
      );
      const frame = lastFrame();
      expect(frame).toContain('CREDENTIALS SETUP');
      expect(frame).toContain('OPTION 1');
      expect(frame).toContain('OPTION 2');
      expect(frame).toContain('PROFILE');
      expect(frame).toContain('ENVIRONMENT');
    });

    it('should show credentials file path', () => {
      const { lastFrame } = render(
        <AuthLoginView credentialsPath="/home/user/.grid-cli/credentials.json" />
      );
      expect(lastFrame()).toContain('/home/user/.grid-cli/credentials.json');
    });

    it('should show verify command', () => {
      const { lastFrame } = render(
        <AuthLoginView credentialsPath="/path/to/creds.json" />
      );
      expect(lastFrame()).toContain('grid auth status');
    });
  });

  describe('SupplyListView', () => {
    const issuances: SupplyIssuance[] = [
      { id: 'issuance_123', instrumentId: 'instrument_abc', quantity: 100, issuedAt: '2024-01-15T10:00:00Z' },
      { id: 'issuance_456', instrumentId: 'instrument_def', quantity: 200, issuedAt: '2024-01-16T10:00:00Z' },
    ];

    it('should render empty state', () => {
      const { lastFrame } = render(<SupplyListView issuances={[]} />);
      const frame = lastFrame();
      expect(frame).toContain('No supply issuances found');
      expect(frame).toContain('grid supply issue');
    });

    it('should render issuances table', () => {
      const { lastFrame } = render(<SupplyListView issuances={issuances} />);
      const frame = lastFrame();
      expect(frame).toContain('SUPPLY ISSUANCES');
      expect(frame).toContain('issuance_123');
      expect(frame).toContain('instrument_abc');
      expect(frame).toContain('100');
      expect(frame).toContain('Total: 2 issuances');
    });

    it('should tolerate rows with missing ids from the API', () => {
      const sparse: SupplyIssuance[] = [
        { quantity: 10 } as SupplyIssuance,
      ];
      const { lastFrame } = render(<SupplyListView issuances={sparse} />);
      const frame = lastFrame();
      expect(frame).toContain('SUPPLY ISSUANCES');
      expect(frame).toContain('—');
      expect(frame).toContain('10');
    });

    it('should show loading state', () => {
      const { lastFrame } = render(<SupplyListView issuances={[]} loading={true} />);
      expect(lastFrame()).toContain('Fetching supply issuances');
    });

    it('should show error state', () => {
      const { lastFrame } = render(
        <SupplyListView issuances={[]} error="API error" />
      );
      expect(lastFrame()).toContain('API error');
    });
  });

  describe('SupplySummaryView', () => {
    const summaries: SupplySummaryItem[] = [
      { instrumentName: 'Bitcoin', instrumentId: 'btc', symbol: 'BTC', totalIssued: 1000, unitsAvailable: 800, unitsTransferred: 200 },
      { instrumentName: 'Ethereum', instrumentId: 'eth', symbol: 'ETH', totalIssued: 500, unitsAvailable: 500, unitsTransferred: 0 },
    ];

    const totals: SupplySummaryTotals = {
      totalIssued: 1500,
      totalAvailable: 1300,
      totalTransferred: 200,
    };

    it('should render empty state', () => {
      const { lastFrame } = render(<SupplySummaryView summaries={[]} />);
      const frame = lastFrame();
      expect(frame).toContain('No supply found');
      expect(frame).toContain('grid supply issue');
    });

    it('should render summary table', () => {
      const { lastFrame } = render(
        <SupplySummaryView summaries={summaries} totals={totals} />
      );
      const frame = lastFrame();
      expect(frame).toContain('SUPPLY SUMMARY');
      expect(frame).toContain('Bitcoin');
      expect(frame).toContain('BTC');
      expect(frame).toContain('1000');
      expect(frame).toContain('800');
    });

    it('should render totals', () => {
      const { lastFrame } = render(
        <SupplySummaryView summaries={summaries} totals={totals} />
      );
      const frame = lastFrame();
      expect(frame).toContain('1500');
      expect(frame).toContain('1300');
      expect(frame).toContain('200');
    });

    it('should show loading state', () => {
      const { lastFrame } = render(<SupplySummaryView summaries={[]} loading={true} />);
      expect(lastFrame()).toContain('Fetching supply summary');
    });
  });

  describe('StrategyListView', () => {
    const strategies: StrategyInfo[] = [
      { name: 'simple-market-maker' },
      { name: 'grid-trader', description: 'Grid trading strategy' },
    ];

    it('should render empty state', () => {
      const { lastFrame } = render(<StrategyListView strategies={[]} />);
      expect(lastFrame()).toContain('No strategies found');
    });

    it('should render strategies list', () => {
      const { lastFrame } = render(<StrategyListView strategies={strategies} />);
      const frame = lastFrame();
      expect(frame).toContain('STRATEGIES');
      expect(frame).toContain('simple-market-maker');
      expect(frame).toContain('grid-trader');
      expect(frame).toContain('Grid trading strategy');
    });

    it('should show run hint', () => {
      const { lastFrame } = render(<StrategyListView strategies={strategies} />);
      expect(lastFrame()).toContain('grid strategy start');
    });

    it('should show error state', () => {
      const { lastFrame } = render(
        <StrategyListView strategies={[]} error="Directory not found" />
      );
      expect(lastFrame()).toContain('Directory not found');
    });
  });
});
