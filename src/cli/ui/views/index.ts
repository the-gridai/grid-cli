/**
 * View Components
 * 
 * Complete views for CLI commands - these render, display output, and exit.
 */

export { StatusView } from './StatusView';
export type { StatusViewProps } from './StatusView';

export { BalanceView } from './BalanceView';
export type { BalanceViewProps, BalanceData } from './BalanceView';

export { OrderListView } from './OrderListView';
export type { OrderListViewProps, OrderData } from './OrderListView';

export { ActionFeedbackView } from './ActionFeedbackView';
export type { ActionFeedbackViewProps, ActionStatus } from './ActionFeedbackView';

export { ProfileListView } from './ProfileListView';
export type { ProfileListViewProps, ProfileInfo } from './ProfileListView';

export { ProfileDetailView } from './ProfileDetailView';
export type { ProfileDetailViewProps, ProfileDetailData } from './ProfileDetailView';

export { AuthStatusView } from './AuthStatusView';
export type { AuthStatusViewProps, AuthStatusData, ConnectionStatus } from './AuthStatusView';

export { AuthLoginView } from './AuthLoginView';
export type { AuthLoginViewProps } from './AuthLoginView';

export { DeviceAuthLoginView } from './DeviceAuthLoginView';
export type { DeviceAuthLoginViewProps } from './DeviceAuthLoginView';

export { AuthLogoutView } from './AuthLogoutView';
export type { AuthLogoutViewProps } from './AuthLogoutView';

export { SupplyListView } from './SupplyListView';
export type { SupplyListViewProps, SupplyIssuance } from './SupplyListView';

export { SupplySummaryView } from './SupplySummaryView';
export type { SupplySummaryViewProps, SupplySummaryItem, SupplySummaryTotals } from './SupplySummaryView';

export { StrategyListView } from './StrategyListView';
export type { StrategyListViewProps, StrategyInfo } from './StrategyListView';

// Hotwire command views
export { HotwireStreamView } from './HotwireStreamView';

// Consumption command views
export { ConsumptionModelsView } from './ConsumptionModelsView';
export { ConsumptionBalanceView } from './ConsumptionBalanceView';

// Legacy exports (deprecated - use Consumption* views instead)
export { RunModelsView } from './RunModelsView';
export { RunBalanceView } from './RunBalanceView';
