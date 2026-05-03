/**
 * Unit Tests for Configuration
 */

import { config } from '../../src/config/index';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should have default launcher URL', () => {
    delete process.env.LAUNCHER_URL;
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.launcher.baseUrl).toBe('http://localhost:7777');
  });

  it('should read LAUNCHER_URL from env', () => {
    process.env.LAUNCHER_URL = 'http://custom:8888';
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.launcher.baseUrl).toBe('http://custom:8888');
  });

  it('should have default log level', () => {
    delete process.env.LOG_LEVEL;
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.log.level).toBe('info');
  });

  it('should read LOG_LEVEL from env', () => {
    process.env.LOG_LEVEL = 'debug';
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.log.level).toBe('debug');
  });

  it('should have simulation disabled by default', () => {
    delete process.env.SIMULATION_MODE;
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.simulation.enabled).toBe(false);
  });

  it('should read SIMULATION_MODE from env', () => {
    process.env.SIMULATION_MODE = 'true';
    jest.resetModules();
    const freshConfig = require('../../src/config/index').config;
    expect(freshConfig.simulation.enabled).toBe(true);
  });

  it('should throw on invalid integer env var', () => {
    process.env.LAUNCHER_TIMEOUT_MS = 'not-a-number';
    jest.resetModules();
    expect(() => require('../../src/config/index')).toThrow('must be a valid integer');
  });
});
