import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import {
  Spinner,
  Table,
  StyledBox,
  StatusBadge,
  KeyValue,
  Header,
  Divider,
} from '../../../../src/cli/ui/components';
import { colors } from '../../../../src/cli/ui/theme';

describe('UI Components', () => {
  describe('Spinner', () => {
    it('should render without label', () => {
      const { lastFrame } = render(<Spinner />);
      expect(lastFrame()).toBeTruthy();
    });

    it('should render with label', () => {
      const { lastFrame } = render(<Spinner label="Loading..." />);
      expect(lastFrame()).toContain('Loading...');
    });

    it('should render grid type spinner', () => {
      const { lastFrame } = render(<Spinner type="grid" label="Processing" />);
      expect(lastFrame()).toContain('Processing');
    });
  });

  describe('Table', () => {
    interface TestData {
      id: string;
      name: string;
      value: number;
    }

    const testData: TestData[] = [
      { id: '1', name: 'Item A', value: 100 },
      { id: '2', name: 'Item B', value: 200 },
    ];

    const columns = [
      { header: 'ID', accessor: 'id' as const, width: 5 },
      { header: 'Name', accessor: 'name' as const, width: 10 },
      { header: 'Value', accessor: 'value' as const, width: 8, align: 'right' as const },
    ];

    it('should render table with data', () => {
      const { lastFrame } = render(
        <Table data={testData} columns={columns} />
      );
      const frame = lastFrame();
      expect(frame).toContain('ID');
      expect(frame).toContain('NAME');
      expect(frame).toContain('VALUE');
      expect(frame).toContain('Item A');
      expect(frame).toContain('100');
    });

    it('should render table with title', () => {
      const { lastFrame } = render(
        <Table data={testData} columns={columns} title="ITEMS" />
      );
      expect(lastFrame()).toContain('ITEMS_');
    });

    it('should render table with footer', () => {
      const { lastFrame } = render(
        <Table data={testData} columns={columns} footer="Total: 2 items" />
      );
      expect(lastFrame()).toContain('Total: 2 items');
    });

    it('should handle empty data', () => {
      const { lastFrame } = render(
        <Table data={[]} columns={columns} />
      );
      expect(lastFrame()).toContain('ID');
    });

    it('should respect maxRows', () => {
      const { lastFrame } = render(
        <Table data={testData} columns={columns} maxRows={1} />
      );
      const frame = lastFrame();
      expect(frame).toContain('Item A');
      expect(frame).not.toContain('Item B');
      expect(frame).toContain('and 1 more');
    });

    it('should support accessor functions', () => {
      const columnsWithFn: { header: string; accessor: (row: TestData) => string }[] = [
        { header: 'Computed', accessor: (row: TestData) => `${row.name}-${row.value}` },
      ];
      const { lastFrame } = render(
        <Table<TestData> data={testData} columns={columnsWithFn} />
      );
      expect(lastFrame()).toContain('Item A-100');
    });
  });

  describe('StyledBox', () => {
    it('should render children', () => {
      const { lastFrame } = render(
        <StyledBox>
          <Text>Content</Text>
        </StyledBox>
      );
      expect(lastFrame()).toContain('Content');
    });

    it('should render with title', () => {
      const { lastFrame } = render(
        <StyledBox title="STATUS">
          <Text>Online</Text>
        </StyledBox>
      );
      const frame = lastFrame();
      expect(frame).toContain('STATUS_');
      expect(frame).toContain('Online');
    });

    it('should render without border', () => {
      const { lastFrame } = render(
        <StyledBox borderStyle="none" title="TEST">
          <Text>Content</Text>
        </StyledBox>
      );
      const frame = lastFrame();
      expect(frame).toContain('TEST_');
      expect(frame).toContain('Content');
    });
  });

  describe('StatusBadge', () => {
    it('should render success status', () => {
      const { lastFrame } = render(
        <StatusBadge status="success" label="Connected" />
      );
      expect(lastFrame()).toContain('Connected');
    });

    it('should render with dot', () => {
      const { lastFrame } = render(
        <StatusBadge status="success" label="Online" showDot />
      );
      const frame = lastFrame();
      expect(frame).toContain('●');
      expect(frame).toContain('Online');
    });

    it('should render with underscore', () => {
      const { lastFrame } = render(
        <StatusBadge status="info" label="Active" withUnderscore />
      );
      expect(lastFrame()).toContain('Active_');
    });

    it('should render error status', () => {
      const { lastFrame } = render(
        <StatusBadge status="error" label="Failed" />
      );
      expect(lastFrame()).toContain('Failed');
    });
  });

  describe('KeyValue', () => {
    it('should render key-value pairs', () => {
      const { lastFrame } = render(
        <KeyValue
          items={[
            { label: 'Name', value: 'Test' },
            { label: 'Status', value: 'Active' },
          ]}
        />
      );
      const frame = lastFrame();
      expect(frame).toContain('Name');
      expect(frame).toContain('Test');
      expect(frame).toContain('Status');
      expect(frame).toContain('Active');
    });

    it('should handle custom label width', () => {
      const { lastFrame } = render(
        <KeyValue
          items={[{ label: 'Key', value: 'Value' }]}
          labelWidth={20}
        />
      );
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('Header', () => {
    it('should render with title', () => {
      const { lastFrame } = render(
        <Header title="ORDERS" />
      );
      expect(lastFrame()).toContain('ORDERS_');
    });

    it('should render with logo', () => {
      const { lastFrame } = render(
        <Header showLogo />
      );
      expect(lastFrame()).toContain('THE GRID_');
    });

    it('should render with tagline', () => {
      const { lastFrame } = render(
        <Header showLogo showTagline />
      );
      const frame = lastFrame();
      expect(frame).toContain('THE GRID_');
      expect(frame).toContain('LIVE LIQUIDITY');
    });

    it('should render with status', () => {
      const { lastFrame } = render(
        <Header title="TEST" status={<Text color="green">● Live</Text>} />
      );
      const frame = lastFrame();
      expect(frame).toContain('TEST_');
      expect(frame).toContain('Live');
    });
  });

  describe('Divider', () => {
    it('should render horizontal line', () => {
      const { lastFrame } = render(<Divider width={10} />);
      expect(lastFrame()).toContain('──────────');
    });

    it('should render with title', () => {
      const { lastFrame } = render(<Divider title="Section" width={20} />);
      expect(lastFrame()).toContain('Section');
    });
  });
});
