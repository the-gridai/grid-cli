import React from 'react';
import { Text, Box } from 'ink';
import { colors, boxChars } from '../theme';

export interface TableColumn<T> {
  /** Column header text */
  header: string;
  /** Key in data object or accessor function */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Column width (in characters) */
  width?: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Color for this column's values */
  color?: string | ((value: unknown, row: T) => string);
}

export interface TableProps<T> {
  /** Array of data rows */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Show border around table */
  border?: boolean;
  /** Table title (with trailing underscore) */
  title?: string;
  /** Footer text */
  footer?: string;
  /** Maximum rows to display */
  maxRows?: number;
  /** Index of selected row (for interactive mode) */
  selectedIndex?: number;
  /** Callback when a row is clicked */
  onRowClick?: (index: number) => void;
}

/**
 * Grid-styled data table with borders and colors
 * 
 * @example
 * <Table
 *   title="ORDERS"
 *   data={orders}
 *   columns={[
 *     { header: 'ID', accessor: 'id', width: 15 },
 *     { header: 'SIDE', accessor: 'side', color: (v) => v === 'buy' ? colors.primary : colors.accent },
 *     { header: 'SIZE', accessor: 'size', align: 'right' },
 *   ]}
 * />
 */
export function Table<T extends object>({ 
  data, 
  columns, 
  border = true,
  title,
  footer,
  maxRows,
  selectedIndex,
}: TableProps<T>): React.ReactElement {
  // Calculate column widths
  const colWidths = columns.map(col => {
    if (col.width) return col.width;
    const headerLen = col.header.length;
    const maxDataLen = data.reduce((max, row) => {
      const value = getCellValue(row, col);
      const len = String(value ?? '').length;
      return Math.max(max, len);
    }, 0);
    return Math.max(headerLen, maxDataLen) + 2;
  });

  const displayData = maxRows ? data.slice(0, maxRows) : data;

  return (
    <Box flexDirection="column">
      {/* Title */}
      {title && (
        <Text color={colors.text} bold>
          {title}_
        </Text>
      )}

      {/* Top border */}
      {border && (
        <Text color={colors.textMuted}>
          {boxChars.topLeft}
          {colWidths.map((w, i) => (
            <React.Fragment key={i}>
              {boxChars.horizontal.repeat(w)}
              {i < colWidths.length - 1 ? boxChars.teeDown : ''}
            </React.Fragment>
          ))}
          {boxChars.topRight}
        </Text>
      )}

      {/* Header row */}
      <Box>
        {border && <Text color={colors.textMuted}>{boxChars.vertical}</Text>}
        {columns.map((col, i) => (
          <React.Fragment key={i}>
            <Box width={colWidths[i]} justifyContent={getJustify(col.align)}>
              <Text color={colors.textMuted} bold>
                {' '}{col.header.toUpperCase()}{' '}
              </Text>
            </Box>
            {border && <Text color={colors.textMuted}>{boxChars.vertical}</Text>}
          </React.Fragment>
        ))}
      </Box>

      {/* Header separator */}
      {border && (
        <Text color={colors.textMuted}>
          {boxChars.teeRight}
          {colWidths.map((w, i) => (
            <React.Fragment key={i}>
              {boxChars.horizontal.repeat(w)}
              {i < colWidths.length - 1 ? boxChars.cross : ''}
            </React.Fragment>
          ))}
          {boxChars.teeLeft}
        </Text>
      )}

      {/* Data rows */}
      {displayData.map((row, rowIndex) => {
        const isSelected = selectedIndex !== undefined && rowIndex === selectedIndex;
        return (
          <Box key={rowIndex}>
            {border && <Text color={colors.textMuted}>{boxChars.vertical}</Text>}
            {columns.map((col, colIndex) => {
              const value = getCellValue(row, col);
              const cellColor = isSelected ? colors.accent : getCellColor(col, value, row);
              return (
                <React.Fragment key={colIndex}>
                  <Box width={colWidths[colIndex]} justifyContent={getJustify(col.align)}>
                    <Text color={cellColor} inverse={isSelected}>
                      {' '}{formatCellValue(value)}{' '}
                    </Text>
                  </Box>
                  {border && <Text color={colors.textMuted}>{boxChars.vertical}</Text>}
                </React.Fragment>
              );
            })}
          </Box>
        );
      })}

      {/* Bottom border */}
      {border && (
        <Text color={colors.textMuted}>
          {boxChars.bottomLeft}
          {colWidths.map((w, i) => (
            <React.Fragment key={i}>
              {boxChars.horizontal.repeat(w)}
              {i < colWidths.length - 1 ? boxChars.teeUp : ''}
            </React.Fragment>
          ))}
          {boxChars.bottomRight}
        </Text>
      )}

      {/* Footer */}
      {footer && (
        <Text color={colors.textMuted} dimColor>
          {footer}
        </Text>
      )}

      {/* Truncation notice */}
      {maxRows && data.length > maxRows && (
        <Text color={colors.textMuted} dimColor>
          ... and {data.length - maxRows} more
        </Text>
      )}
    </Box>
  );
}

function getCellValue<T>(row: T, col: TableColumn<T>): unknown {
  if (typeof col.accessor === 'function') {
    return col.accessor(row);
  }
  return row[col.accessor];
}

function getCellColor<T>(col: TableColumn<T>, value: unknown, row: T): string {
  if (typeof col.color === 'function') {
    return col.color(value, row);
  }
  if (col.color) {
    return col.color;
  }
  return colors.text;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (React.isValidElement(value)) {
    return String(value);
  }
  return String(value);
}

function getJustify(align?: 'left' | 'center' | 'right'): 'flex-start' | 'center' | 'flex-end' {
  switch (align) {
    case 'right':
      return 'flex-end';
    case 'center':
      return 'center';
    default:
      return 'flex-start';
  }
}

export default Table;
