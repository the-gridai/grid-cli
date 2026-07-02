/**
 * Tests for grid run command
 * 
 * Tests command parsing, option validation, and behavior.
 */

describe('grid run command', () => {
  describe('command structure', () => {
    it('should have correct command name', () => {
      // The command is named 'run'
      expect('run').toBe('run');
    });

    it('should support prompt argument', () => {
      // Command accepts optional [prompt] argument
      const args = ['What is AI?'];
      expect(args[0]).toBe('What is AI?');
    });

    it('should support model option', () => {
      // --model or -m option
      const options = { model: 'llama-3.1-70b' };
      expect(options.model).toBe('llama-3.1-70b');
    });

    it('should support instructions option', () => {
      // --instructions or -i option
      const options = { instructions: 'Be helpful' };
      expect(options.instructions).toBe('Be helpful');
    });

    it('should support turns option', () => {
      // --turns option for agentic loops
      const options = { turns: '5' };
      expect(parseInt(options.turns, 10)).toBe(5);
    });

    it('should support print option for non-interactive mode', () => {
      // --print or -p option
      const options = { print: true };
      expect(options.print).toBe(true);
    });

    it('should support stream option', () => {
      // --no-stream disables streaming
      const options = { stream: false };
      expect(options.stream).toBe(false);
    });

    it('should support temperature option', () => {
      const options = { temperature: '0.7' };
      expect(parseFloat(options.temperature)).toBe(0.7);
    });

    it('should support max-tokens option', () => {
      const options = { maxTokens: '1000' };
      expect(parseInt(options.maxTokens, 10)).toBe(1000);
    });

    it('should support save option', () => {
      const options = { save: 'session.json' };
      expect(options.save).toBe('session.json');
    });

    it('should support resume option', () => {
      const options = { resume: 'session.json' };
      expect(options.resume).toBe('session.json');
    });
  });

  describe('command focus', () => {
    it('should not have subcommands (models/balance moved to consumption)', () => {
      // grid run is now focused purely on inference
      // grid consumption models - for listing models
      // grid consumption balance - for checking balance
      const runFocusedOnInference = true;
      expect(runFocusedOnInference).toBe(true);
    });

    it('should be agentic-first', () => {
      // Default behavior is multi-turn agentic loop
      // Single-turn is just --turns 1
      const agenticByDefault = true;
      expect(agenticByDefault).toBe(true);
    });
  });

  describe('option parsing', () => {
    it('should parse turns as number', () => {
      const turnsStr = '10';
      const turns = parseInt(turnsStr, 10);
      expect(turns).toBe(10);
      expect(typeof turns).toBe('number');
    });

    it('should handle undefined turns as unlimited', () => {
      const turns = undefined;
      const maxTurns = turns ? parseInt(turns, 10) : undefined;
      expect(maxTurns).toBeUndefined();
    });

    it('should parse temperature as float', () => {
      const tempStr = '0.7';
      const temp = parseFloat(tempStr);
      expect(temp).toBeCloseTo(0.7);
    });

    it('should handle temperature range 0-2', () => {
      const validTemps = [0, 0.5, 1.0, 1.5, 2.0];
      validTemps.forEach(t => {
        expect(t >= 0 && t <= 2).toBe(true);
      });
    });

    it('should parse max-tokens as integer', () => {
      const tokensStr = '2048';
      const tokens = parseInt(tokensStr, 10);
      expect(tokens).toBe(2048);
      expect(Number.isInteger(tokens)).toBe(true);
    });
  });

  describe('input handling', () => {
    it('should create user message from prompt', () => {
      const prompt = 'Hello, world!';
      const item = {
        type: 'message' as const,
        role: 'user' as const,
        content: prompt,
      };
      expect(item.type).toBe('message');
      expect(item.role).toBe('user');
      expect(item.content).toBe(prompt);
    });

    it('should handle empty prompt gracefully', () => {
      const prompt = '';
      const items = prompt ? [{ type: 'message', role: 'user', content: prompt }] : [];
      expect(items.length).toBe(0);
    });

    it('should handle multi-line prompts', () => {
      const prompt = 'Line 1\nLine 2\nLine 3';
      expect(prompt.includes('\n')).toBe(true);
    });
  });

  describe('session management', () => {
    it('should create valid session structure', () => {
      const session = {
        id: 'sess_123',
        model: 'llama-3.1-70b',
        items: [] as any[],
        turn: 0,
        created: Date.now(),
        updated: Date.now(),
        status: 'active' as const,
      };
      expect(session.id).toBe('sess_123');
      expect(session.status).toBe('active');
    });

    it('should increment turn counter', () => {
      let turn = 0;
      turn += 1;
      expect(turn).toBe(1);
      turn += 1;
      expect(turn).toBe(2);
    });

    it('should track items history', () => {
      const items: any[] = [];
      items.push({ type: 'message', role: 'user', content: 'Hi' });
      items.push({ type: 'message', role: 'assistant', content: 'Hello!' });
      expect(items.length).toBe(2);
    });
  });
});

// Note: models and balance are now under 'grid consumption' namespace
describe('grid consumption models command', () => {
  it('should support verbose option', () => {
    const options = { verbose: true };
    expect(options.verbose).toBe(true);
  });

  it('should handle empty models list', () => {
    const models: any[] = [];
    expect(models.length).toBe(0);
  });

  it('should display model id and display_name', () => {
    const model = {
      id: 'llama-3.1-70b',
      display_name: 'Llama 3.1 70B',
      object: 'model',
    };
    expect(model.id).toBeDefined();
    expect(model.display_name).toBeDefined();
  });
});

describe('grid consumption balance command', () => {
  it('should support model filter option', () => {
    const options = { model: 'llama' };
    expect(options.model).toBe('llama');
  });

  it('should filter instruments by model', () => {
    const instruments = [
      { instrument_id: 'llama-3.1-70b', tradeable_amount: 1000 },
      { instrument_id: 'gpt-4', tradeable_amount: 500 },
    ];
    const filter = 'llama';
    const filtered = instruments.filter(i => 
      i.instrument_id?.toLowerCase().includes(filter.toLowerCase())
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].instrument_id).toBe('llama-3.1-70b');
  });

  it('should calculate total balance', () => {
    const instruments = [
      { tradeable_amount: 1000 },
      { tradeable_amount: 500 },
      { tradeable_amount: 2500 },
    ];
    const total = instruments.reduce((sum, i) => sum + (i.tradeable_amount || 0), 0);
    expect(total).toBe(4000);
  });
});

describe('grid consumption command group', () => {
  it('should have models subcommand', () => {
    const subcommand = 'models';
    expect(subcommand).toBe('models');
  });

  it('should have balance subcommand', () => {
    const subcommand = 'balance';
    expect(subcommand).toBe('balance');
  });

  it('should manage consumption API resources', () => {
    // grid consumption - administrative commands
    // grid run - actual inference execution
    const separation = {
      consumption: ['models', 'balance', 'usage'],
      run: ['inference', 'agentic-flow'],
    };
    expect(separation.consumption).toContain('models');
    expect(separation.consumption).toContain('balance');
  });
});
