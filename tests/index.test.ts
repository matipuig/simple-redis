/**
 *  TESTS FOR INDEX.
 */

import Redis from '../src';

const redis = new Redis();
// TODO: Change this URL for testing.
const URL = 'redis://localhost:6379';
const PREFIX_1 = 'TESTING_SIMPLEREDIS_1_';
const PREFIX_2 = 'TESTING_SIMPLEREDIS_2_';
const KEYS_COUNT = 2000;
const TEST_VALUES_PREFIX = 'TEST_';
const SUSCRIPTION_CHANNEL = 'TESTING_CHANNEL_UNIT_TESTING';

const receivedMessages: string[] = [];
const TEXT_TO_SEND = 'TEST';
const HOW_MANY_TEXTS_TO_SEND = 50;

const onMessageReceived = function onMessageReceived(message: string) {
  receivedMessages.push(message);
  return true;
};

/**
 *  Starts an object with different values to test in redis.
 */
const initializeValues = function initializeValues(): ValuesType {
  const values: Record<string, string> = {};
  let randomValue;
  for (let i = 0; i < KEYS_COUNT; i += 1) {
    randomValue = Math.random() * 50000;
    values[TEST_VALUES_PREFIX + i] = String(Math.round(randomValue));
  }
  return values;
};

const TEST_VALUES: ValuesType = initializeValues();
const TEST_VALUES_KEYS = Object.keys(TEST_VALUES);

/**
 *  Wait the specified time.
 */
const wait = async function wait(seconds: number): Promise<boolean> {
  const waitUntil = new Date().getTime() + seconds * 1000;
  return new Promise((resolve) => {
    let now = new Date().getTime();
    while (now < waitUntil) {
      now = new Date().getTime();
    }
    resolve(true);
  });
};

/**
 * Empties redis for both prefixes.
 */
const emptyRedis = async function emptyRedis(): Promise<boolean> {
  redis.setPrefix(PREFIX_1);
  await redis.empty();
  redis.setPrefix(PREFIX_2);
  await redis.empty();
  return true;
};

/**
 *  Get the actual state of redis.
 */
const getStateByPrefix = function getStateByPrefix(prefix: string): Promise<RedisState> {
  redis.setPrefix(prefix);
  return redis.getManyByPattern('*');
};

/**
 *  Controls the state has something.
 *  Throws an error if it doesn't.
 */
const checkHasState = async function hasState(): Promise<boolean> {
  const actualState = await redis.keys('*');
  if (Object.keys(actualState).length === 0) {
    throw new Error('Redis should have some content!');
  }
  return true;
};

const executeTestWithBothPrefixes = async function executeTestWithBothPrefixes(
  functionToTest: any,
): Promise<boolean> {
  // Changes state in redis with prefix 1. Prefix 2 should be not modified.
  const firstStatePrefix2 = await getStateByPrefix(PREFIX_2);
  redis.setPrefix(PREFIX_1);
  await functionToTest();
  const secondStatePrefix2 = await getStateByPrefix(PREFIX_2);
  expect(secondStatePrefix2).toEqual(firstStatePrefix2);

  // Changes state in redis with prefix 2. Prefix 1 should be not modified.
  const firstStatePrefix1 = await getStateByPrefix(PREFIX_1);
  redis.setPrefix(PREFIX_2);
  await functionToTest();
  const secondStatePrefix1 = await getStateByPrefix(PREFIX_1);
  expect(secondStatePrefix1).toEqual(firstStatePrefix1);

  return true;
};

/**
 *  Executes the specified function in both prefixes, controlling one doesn't affect the other.
 */
type RedisState = Record<string, string>;
type ValuesType = Record<string, string>;

/**
 *  Get redis state according to prefix.
 */
test("Connection control, it shouldn't work if it's not connected (redis.connect)", async () => {
  const getValue = async () => await redis.get('SOME VALUE');
  await expect(getValue()).rejects.toThrow();
  expect(redis.isConnected()).toBe(false);
  await redis.connect(URL, PREFIX_1, true);
  expect(redis.isConnected()).toBe(true);
  await redis.subscribe(SUSCRIPTION_CHANNEL, onMessageReceived);
  await emptyRedis();
  redis.setPrefix(PREFIX_1);
});

test('Setting and getting values (redis.set, redis.get)', async () => {
  return executeTestWithBothPrefixes(async () => {
    let valueKey: string;
    let tmpResult: string;

    for (let i = 0; i < TEST_VALUES_KEYS.length; i += 1) {
      valueKey = TEST_VALUES_KEYS[i];
      // eslint-disable-next-line no-await-in-loop
      await redis.set(valueKey, TEST_VALUES[valueKey]);
    }

    for (let i = 0; i < TEST_VALUES_KEYS.length; i += 1) {
      valueKey = TEST_VALUES_KEYS[i];
      // eslint-disable-next-line no-await-in-loop
      tmpResult = (await redis.get(valueKey)) || '';
      expect(tmpResult).toEqual(TEST_VALUES[valueKey]);
    }
    checkHasState();
  });
});

test('Getting keys and count (redis.keys and redis.count)', async () => {
  return executeTestWithBothPrefixes(async () => {
    checkHasState();

    const redisKeys = await redis.keys('*');
    expect(redisKeys.sort()).toEqual(TEST_VALUES_KEYS.sort());

    const checkWithPattern = async (pattern: string): Promise<string[]> => {
      const keysFiltered = TEST_VALUES_KEYS.filter((e) => e.startsWith(pattern));
      const redisKeysWithPattern = await redis.keys(pattern + '*');
      const howManyWithPattern = await redis.count(pattern + '*');
      expect(redisKeysWithPattern.sort()).toEqual(keysFiltered.sort());
      expect(howManyWithPattern).toEqual(keysFiltered.length);
      return redisKeysWithPattern;
    };

    const keysWithPattern1 = await checkWithPattern(`${TEST_VALUES_PREFIX}1`);
    const keysWithPattern2 = await checkWithPattern(`${TEST_VALUES_PREFIX}2`);
    const keysWithPattern3 = await checkWithPattern(`${TEST_VALUES_PREFIX}3`);

    expect(keysWithPattern1.sort()).not.toEqual(keysWithPattern2.sort());
    expect(keysWithPattern2).not.toEqual(keysWithPattern3.sort());
    expect(keysWithPattern3).not.toEqual(keysWithPattern1);
  });
});

test('Getting many (redis.getMany)', async () => {
  return executeTestWithBothPrefixes(async () => {
    checkHasState();

    const results = await redis.getMany(TEST_VALUES_KEYS);
    expect(results).toEqual(TEST_VALUES);

    let mustDelete = true;
    const newKeys = TEST_VALUES_KEYS.filter(() => {
      mustDelete = !mustDelete;
      return mustDelete;
    });

    const filteredResults = await redis.getMany(newKeys);
    Object.keys(filteredResults).forEach((key) => {
      expect(filteredResults[key]).toEqual(TEST_VALUES[key]);
    });
  });
});

test('Getting by pattern (redis.getManyByPattern)', async () => {
  return executeTestWithBothPrefixes(async () => {
    checkHasState();

    const results = await redis.getManyByPattern('*');
    expect(results).toEqual(TEST_VALUES);

    const checkWithPattern = async (pattern: string): Promise<string[]> => {
      const keysFiltered = TEST_VALUES_KEYS.filter((e) => e.startsWith(pattern));
      const resultsWithPattern = await redis.getManyByPattern(pattern + '*');
      const resultsKeys = Object.keys(resultsWithPattern);

      expect(resultsKeys.sort()).toEqual(keysFiltered.sort());
      resultsKeys.forEach((key) => {
        expect(resultsWithPattern[key]).toEqual(TEST_VALUES[key]);
      });
      return resultsKeys;
    };

    const keysWithPattern1 = await checkWithPattern(`${TEST_VALUES_PREFIX}1`);
    const keysWithPattern2 = await checkWithPattern(`${TEST_VALUES_PREFIX}2`);
    const keysWithPattern3 = await checkWithPattern(`${TEST_VALUES_PREFIX}3`);

    expect(keysWithPattern1).not.toEqual(keysWithPattern2);
    expect(keysWithPattern2).not.toEqual(keysWithPattern3);
    expect(keysWithPattern3).not.toEqual(keysWithPattern1);
  });
});

test('Incr and decr by (redis.incrBy, redis.decrBy, redis.decr, redis.incr)', async () => {
  return executeTestWithBothPrefixes(async () => {
    const whichKey = `${TEST_VALUES_PREFIX}1`;
    checkHasState();

    const initialValue = await redis.get(whichKey);
    const initialNumber = Number(initialValue);
    await redis.incrBy(whichKey, 10);
    await redis.incrBy(whichKey, 20);
    await redis.incrBy(whichKey, -10);
    await redis.incr(whichKey);
    const incrementedValue = await redis.get(whichKey);
    expect(incrementedValue).toEqual(String(initialNumber + 21));

    await redis.decrBy(whichKey, 10);
    await redis.decrBy(whichKey, 20);
    await redis.decrBy(whichKey, -10);
    await redis.decr(whichKey);
    const decrementedValue = await redis.get(whichKey);
    expect(decrementedValue).toEqual(String(initialNumber));
  });
});

test('Deleting (redis.del)', async () => {
  return executeTestWithBothPrefixes(async () => {
    checkHasState();

    const totalKeysCount = TEST_VALUES_KEYS.length;
    let valueKey: string;
    let resultCount: number = 0;

    for (let i = 0; i < totalKeysCount / 2; i += 1) {
      valueKey = TEST_VALUES_KEYS[i];
      // eslint-disable-next-line no-await-in-loop
      await redis.del([valueKey]);
      // eslint-disable-next-line no-await-in-loop
      resultCount = await redis.count('*');
      expect(resultCount).toEqual(totalKeysCount - (i + 1));
    }

    const keysWithDeletions = await redis.keys('*');
    expect(keysWithDeletions.length).toBeGreaterThan(0);
    expect(keysWithDeletions.length).toBeLessThan(totalKeysCount);

    await redis.del(keysWithDeletions);
    const finalCount = await redis.count('*');
    expect(finalCount).toBe(0);
  });
});

test('Setting many (redis.setMany)', async () => {
  return executeTestWithBothPrefixes(async () => {
    await redis.setMany(TEST_VALUES);
    const results = await redis.getManyByPattern('*');
    expect(results).toEqual(TEST_VALUES);
  });
});

test('Deleting with pattern (redis.delWithPattern)', async () => {
  checkHasState();
  const REDIS_PREFIX = `${TEST_VALUES_PREFIX}1*`;

  const initialKeys = await redis.count(REDIS_PREFIX);
  expect(initialKeys).toBeGreaterThan(0);

  await redis.delWithPattern(REDIS_PREFIX);
  const keysPostDel = await redis.count(REDIS_PREFIX);
  expect(keysPostDel).toBe(0);
});

test('Emptying (redis.empty)', async () => {
  checkHasState();
  await redis.empty();
  const finalCount = await redis.count('*');
  expect(finalCount).toEqual(0);
});

test('Sending messages by channel (redis.publish, redis.subscribe, redis.unsubscribe)', async () => {
  for (let i = 0; i <= HOW_MANY_TEXTS_TO_SEND; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await redis.publish(SUSCRIPTION_CHANNEL, TEXT_TO_SEND);
  }

  await wait(3);

  expect(receivedMessages.length).toEqual(HOW_MANY_TEXTS_TO_SEND);
  expect(receivedMessages.shift()).toEqual(TEXT_TO_SEND);

  await redis.unsubscribe(SUSCRIPTION_CHANNEL);
  await redis.publish(SUSCRIPTION_CHANNEL, 'ANOTHER TEXT');

  await wait(1);
  expect(receivedMessages.length).toEqual(HOW_MANY_TEXTS_TO_SEND);
});

test('End connection', async () => {
  await redis.close();
  expect(redis.isConnected()).toBe(false);
});
