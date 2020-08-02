/**
 * 	REDIS
 * 	This object allows you to get and set variables from redis very easily. Also it allows you to publish and subscribe.
 */

import redis from 'redis';

type OnReceiveFunction = (message: string) => any;
type Suscriptions = Record<string, OnReceiveFunction[]>;
type Counts = Record<string, number>;
type MultipleResults = Record<string, string>;

class SimpleRedisClient {
  private _varRedis: redis.RedisClient | undefined = undefined;

  private _subRedis: redis.RedisClient | undefined = undefined;

  private _connected: boolean = false;

  private _suscriptions: Suscriptions = {};

  private _counts: Counts = {
    get: 0,
    set: 0,
    incr: 0,
    decr: 0,
    del: 0,
    publish: 0,
    subscribe: 0,
    unsubscribe: 0,
  };

  private _prefix: string = '';

  /**
   * 	Gets redis client.
   */
  getRedis(): redis.RedisClient {
    if (typeof this._varRedis === 'undefined') {
      throw new Error('Redis is not established.');
    }
    return this._varRedis;
  }

  /**
   * 	Counts how many times each operation was made.
   */
  getCounts(): Counts {
    return { ...this._counts };
  }

  /**
   *  Sets the prefix used with Redis.
   */
  setPrefix(prefix: string): boolean {
    this._prefix = prefix;
    return true;
  }

  /**
   *  Returns if the redis client is connected.
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * 	Connects to redis client.
   */
  async connect(url: string, prefix: string = '', withPubSub: boolean = false): Promise<boolean> {
    try {
      this._varRedis = await this._createRedisClient(url);
      if (withPubSub) {
        this._subRedis = await this._createRedisClient(url);
      }
      this._prefix = prefix;
    } catch (error) {
      this._connected = false;
      throw error;
    }
    this._connected = true;

    if (!withPubSub) {
      return true;
    }
    const subRedis: any = this._subRedis;
    subRedis.on('message', (channel: string, message: string) => {
      this._messageReceived(channel, message);
    });
    return true;
  }

  /**
   * 	Reset all counters to zero.
   */
  resetCounters(): boolean {
    Object.keys(this._counts).forEach((key: string) => {
      this._counts[key] = 0;
      return true;
    }, this);
    return true;
  }

  /**
   * 	Get redis keys who follows the pattern.
   */
  async keys(pattern: string): Promise<string[]> {
    const redisClient = this._getVarsRedis();
    const patternWithprefix = this._addPrefix(pattern);

    return new Promise((resolve, reject) => {
      redisClient.keys(patternWithprefix, (error: any, keys: string[]) => {
        if (error) {
          reject(error);
        }
        const finalKeys = keys.map((e) => e.replace(this._prefix, ''));
        resolve(finalKeys);
      });
    });
  }

  /**
   * 	Get redis variable by its key.
   */
  async get(key: string): Promise<string | null> {
    const redisClient = this._getVarsRedis();
    const finalKey = this._addPrefix(key);

    return new Promise((resolve, reject) => {
      redisClient.get(finalKey, (error: any, result: string | null) => {
        if (error) {
          reject(error);
        }
        this._counts.get += 1;
        resolve(result);
      });
    });
  }

  /**
   * 	Get redis variables by its names.
   *  It returns an object with the format {key: content, key: content}.
   */
  async getMany(keys: string[]): Promise<MultipleResults> {
    const redisClient = this._getVarsRedis();
    const finalKeys = keys.map(this._addPrefix.bind(this));
    if (finalKeys.length === 0) {
      return {};
    }

    return new Promise((resolve, reject) => {
      redisClient.mget(finalKeys, (error: any, results: any): void => {
        if (error) {
          reject(error);
        }
        if (typeof results === 'undefined') {
          resolve({});
        }

        const finalResult: MultipleResults = {};
        let strKey: string;
        results.forEach((result: any, index: number) => {
          strKey = String(keys[index]);
          finalResult[strKey] = result;
        });

        this._counts.get += 1;
        resolve(finalResult);
      });
    });
  }

  /**
   * 	Get redis variables by the specified pattern (pattern_*).
   *  It returns an object with the format {key: content, key: content}.
   */
  async getManyByPattern(pattern: string): Promise<MultipleResults> {
    let results;
    try {
      const keys = await this.keys(pattern);
      results = await this.getMany(keys);
    } catch (error) {
      throw error;
    }
    return results;
  }

  /**
   * 	Counts how many redis variables have the specified pattern.
   */
  async count(pattern: string): Promise<number> {
    let keys;
    try {
      keys = await this.keys(pattern);
    } catch (error) {
      throw error;
    }
    return keys.length;
  }

  /**
   * 	Sets a value in Redis.
   */
  async set(key: string, value: string | number): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const finalKey = this._addPrefix(key);
    const valueToSet: string = String(value);

    return new Promise((resolve, reject) => {
      redisClient.set(finalKey, valueToSet, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.set += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Sets a values from and object in Redis.
   */
  async setMany(values: Record<string, string>): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const addToRedis: string[] = [];
    let tmpKey;

    Object.keys(values).forEach((key) => {
      tmpKey = this._addPrefix(key);
      addToRedis.push(tmpKey);
      addToRedis.push(values[key]);
    }, this);

    return new Promise((resolve, reject) => {
      redisClient.mset(...addToRedis, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.set += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Increases the value of a number by the specified number.
   */
  async incrBy(key: string, howMuch: number): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const finalKey = this._addPrefix(key);

    return new Promise((resolve, reject) => {
      redisClient.incrby(finalKey, howMuch, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.incr += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Decreases the value of a number by the specified number.
   */
  async decrBy(key: string, howMuch: number): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const finalKey = this._addPrefix(key);

    return new Promise((resolve, reject) => {
      redisClient.decrby(finalKey, howMuch, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.decr += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Increases the specified value by 1.
   */
  async incr(key: string): Promise<boolean> {
    return this.incrBy(key, 1);
  }

  /**
   * 	Decreases the specified value by 1.
   */
  async decr(key: string): Promise<boolean> {
    return this.decrBy(key, 1);
  }

  /**
   *  Deletes the variables with the specified keys.
   */
  async del(keys: string[]): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const finalKeys = keys.map((key) => this._prefix + key);

    if (finalKeys.length === 0) {
      return true;
    }

    return new Promise((resolve, reject) => {
      redisClient.del(finalKeys, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.del += 1;
        resolve(true);
      });
    });
  }

  /**
   *  Deletes the variables with the specified pattern.
   */
  async delWithPattern(pattern: string): Promise<boolean> {
    try {
      const keys = await this.keys(pattern);
      await this.del(keys);
    } catch (error) {
      throw error;
    }
    return true;
  }

  /**
   *  Empties the variables.
   */
  async empty(): Promise<boolean> {
    try {
      const keys = await this.keys('*');
      await this.del(keys);
    } catch (error) {
      throw error;
    }
    return true;
  }

  /**
   *  Publishes in the specified channel.
   */
  async publish(channel: string, message: string): Promise<boolean> {
    const redisClient = this._getVarsRedis();
    const finalChannel = this._addPrefix(channel);

    return new Promise((resolve, reject) => {
      redisClient.publish(finalChannel, message, (error: any) => {
        if (error) {
          reject(error);
        }
        this._counts.publish += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Subscribes a function to a channel.
   */
  async subscribe(channel: string, onReceive: OnReceiveFunction): Promise<boolean> {
    const redisClient = this._getSubsRedis();
    const finalChannel = this._addPrefix(channel);

    if (Array.isArray(this._suscriptions[finalChannel])) {
      this._suscriptions[finalChannel].push(onReceive);
      return true;
    }

    this._suscriptions[finalChannel] = [];
    this._suscriptions[finalChannel].push(onReceive);

    return new Promise((resolve, reject) => {
      redisClient.subscribe(finalChannel, (error: any) => {
        if (error) {
          reject(error);
        }

        this._counts.subscribe += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Unsubscribes from a channel.
   */
  async unsubscribe(channel: string): Promise<boolean> {
    const redisClient = this._getSubsRedis();
    const finalChannel = this._addPrefix(channel);

    return new Promise((resolve, reject) => {
      redisClient.unsubscribe(finalChannel, (error: any) => {
        if (error) {
          reject(error);
        }

        delete this._suscriptions[finalChannel];
        this._counts.unsubscribe += 1;
        resolve(true);
      });
    });
  }

  /**
   * 	Close the connections.
   */
  async close(): Promise<boolean> {
    try {
      if (typeof this._varRedis !== 'undefined') {
        await this._varRedis.end(true);
      }
      if (typeof this._subRedis !== 'undefined') {
        await this._subRedis.end(true);
      }
    } catch (error) {
      throw error;
    }
    this._connected = false;
    return true;
  }

  //*
  //*
  //*	PRIVATE METHODS
  //*
  //*

  /**
   * 	Creates a Redis Instance.
   */
  private async _createRedisClient(url: string): Promise<redis.RedisClient> {
    const options = {
      url,
      enableOfflineQueue: true,
      retryMaxDelay: 500,
      max_attempts: 20000,
      retryStrategy: this._redisRetryStrategy,
    };

    return new Promise((resolve, reject) => {
      const newRedisClient = redis.createClient(options);
      newRedisClient.on('ready', () => resolve(newRedisClient));
      newRedisClient.on('error', (error: any) => reject(error));
    });
  }

  /**
   *  Function to reconnect to redis when connection failed.
   */
  private _redisRetryStrategy(options: any) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server refused the connection.');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted.');
    }
    if (options.attempt > 200000) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }

  /**
   * 	Gets the redis instance. Throws an error if Redis is not connected.
   */
  private _getVarsRedis(): redis.RedisClient {
    if (!this._connected) {
      throw new Error("There's no active Redis Client.");
    }
    const connectedRedis: any = this._varRedis;
    return connectedRedis;
  }

  /**
   * 	Gets the redis instance. Throws an error if Redis is not connected.
   */
  private _getSubsRedis(): redis.RedisClient {
    if (typeof this._subRedis === 'undefined') {
      throw new Error("There's no active Redis Client.");
    }
    const connectedRedis: any = this._subRedis;
    return connectedRedis;
  }

  /**
   * 	Returns the string with the prefix.
   */
  private _addPrefix(text: string): string {
    return this._prefix + text;
  }

  /**
   *  Executes all the functions associated with the channel.
   */
  private _messageReceived(channel: string, message: string): boolean {
    const functionsToExecute = this._suscriptions[channel];
    functionsToExecute.forEach((fn) => fn(message));
    return true;
  }
}

export = SimpleRedisClient;
