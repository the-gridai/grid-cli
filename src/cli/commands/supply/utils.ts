/**
 * Shared utilities for supply commands
 */

import { ApiClient } from '../../../sdk/http/client';

export interface ResolvedInstrument {
  id: string;
  name: string;
  symbol: string;
}

/**
 * Resolve an instrument identifier (symbol or ID) to the actual instrument_id
 * 
 * Tries multiple resolution strategies:
 * 1. If it looks like a UUID, assume it's already an ID
 * 2. If it starts with instrument_ or instrument-, assume it's already an ID
 * 3. Try to list all instruments and find by symbol match
 * 4. Search in supply issuance summary for matching entries (prefer real instrument IDs)
 * 5. Fall back to using the identifier as-is
 * 
 * @param client - API client instance
 * @param identifier - Instrument symbol or ID
 * @returns Resolved instrument with id, name, and symbol
 */
export async function resolveInstrumentId(
  client: ApiClient, 
  identifier: string
): Promise<ResolvedInstrument> {
  // If it looks like a UUID, assume it's already an ID
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(identifier)) {
    return { id: identifier, name: identifier, symbol: identifier };
  }

  // Also check for known wire ID patterns (ME + GX)
  if (identifier.startsWith('instrument_') || identifier.startsWith('instrument-')) {
    return { id: identifier, name: identifier, symbol: identifier };
  }

  // Try to list all instruments and find by symbol
  try {
    const result = await client.getInstruments();
    const instruments = Array.isArray(result) ? result : (result.data || []);
    
    const match = instruments.find((inst: any) => 
      inst.symbol === identifier ||
      inst.symbol?.toLowerCase() === identifier.toLowerCase() ||
      inst.name === identifier ||
      inst.name?.toLowerCase() === identifier.toLowerCase()
    );
    
    if (match) {
      const id = match.instrument_id || match.id;
      if (id) {
        return {
          id,
          name: match.name || id,
          symbol: match.symbol || id
        };
      }
    }
  } catch {
    // Instrument list failed, continue to fallback
  }

  // Try the by-symbol endpoint as a backup
  try {
    const instrument = await client.getInstrumentBySymbol(identifier);
    return {
      id: instrument.instrument_id || instrument.id!,
      name: instrument.name,
      symbol: instrument.symbol
    };
  } catch {
    // Symbol lookup failed, continue to fallback
  }

  // Fallback: search in supply issuance summary for matching instrument_id
  // Prefer entries with real instrument IDs (starting with instrument_)
  try {
    const summary = await client.getSupplyIssuanceSummary();
    const summaries = Array.isArray(summary) ? summary : (summary.data || []);
    
    // First, look for entries with real instrument IDs that have matching symbols
    const realInstrumentMatch = summaries.find((s: any) => 
      s.instrument_id?.startsWith('instrument_') && (
        s.instrument_symbol === identifier ||
        s.instrument_symbol?.toLowerCase() === identifier.toLowerCase()
      )
    );
    
    if (realInstrumentMatch) {
      return {
        id: realInstrumentMatch.instrument_id,
        name: realInstrumentMatch.instrument_name || realInstrumentMatch.instrument_id,
        symbol: realInstrumentMatch.instrument_symbol || identifier
      };
    }
    
    // If no real instrument match, look for any match (including orphaned entries)
    const anyMatch = summaries.find((s: any) => 
      s.instrument_id === identifier || 
      s.instrument_symbol === identifier ||
      s.instrument_id?.toLowerCase() === identifier.toLowerCase() ||
      s.instrument_symbol?.toLowerCase() === identifier.toLowerCase()
    );
    
    if (anyMatch) {
      return {
        id: anyMatch.instrument_id,
        name: anyMatch.instrument_name || anyMatch.instrument_id,
        symbol: anyMatch.instrument_symbol || anyMatch.instrument_id
      };
    }
  } catch {
    // Summary lookup failed
  }

  // Last resort: return the identifier as-is (API will validate)
  return { id: identifier, name: identifier, symbol: identifier };
}
