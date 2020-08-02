# Package
# Simple Redis
This package is an abstraction layer on redis package to make functions more easy and with async/await usage in NodeJS. It's completelly written in TypeScript.
It lets you use it for the Dictionary and also for the pub/sub system.

## Installation
```
npm install redis-simple-client
```

## Usage
```javascript
const RedisSimpleClient = require('redis-simple-client');
const redis = new RedisSimpleClient();
```

### Usage for dictionary
```javascript
async function test(){
  // You can set the URL for the connection, you will NOT use it for pub/sub.
  // The prefix helps you using the same redis client for different apps in the same database.
  // You can have prefix_variable, prefix_variable2, etc. 
  await redis.connect('redis://localhost:6379', 'prefix_', false);
  
  // Set and get variables.
  await redis.set('variable','value');
  const variable = redis.get('variable');
  console.log(variable); // outputs: 'value'
  
  // Set and get many variables.
  const variables = {
    var1: 'Testing 1',
    var2: 'Testing 2',
    var10: 'Testing 3',
  };
  await redis.setMany(variables);
  let results = redis.getMany([var1,var2]);
  console.log(results); // Outputs: {var1: 'Testing 1', var2: 'Testing 2'}
  
  results = redis.getManyWithPattern('var1*');
  console.log(results); // Outpus: {var1: 'Testing 1', var10: 'Testing 3'}
  
  // Deleting values
  await redis.del(['var1']);
  await redis.delWithPattern('var1*');
  
  // Counting and getting keys with patterns.
  await redis.keys('*'); //  Output: ['var2']
  await redis.count('*'); // Output: 1.
  
  // Get how many functions you realized.
  console.log(redis.getCounts()); / Output {get: 2, set: 5, count: 3...}.

  // Close the connection.
  await redis.close();
}
```

### Usage for pub/sub system
```javascript
async function test(){
  // You will still be able to use dictionary functions, but with TRUE you will also be able to use pub/sub.
  await redis.connect('redis://localhost:6379', 'prefix_', true);
  
  await redis.subscribe('CHANNEL', (message) => console.log(message));
  await redis.publish('CHANNEL', 'Hello!');
  await redis.unsubsribe('CHANNEL');
  await redis.close();
}
```

### All methods
Method | Description
------------ | -------------
getRedis | Gets original Redis Client.
getCounts | Gets an object with how many times each function was executed.
setPrefix | Establishes the prefix for all variables in Redis.
isConnected | Gets if redis is connected or not.
resetCounters | Sets all counters to zero.
connect | Connects to the specified url and sets the prefix.
get | Gets the entry with the specified key.
getMany | Gets many entries with the specified keys.
getWithPattern | Gets all the entries that fit the specified pattern.
count | Counts how many entries fit the specified pattern.
set | Sets the entry with the specified key
setMany | Sets many entries at the same time.
incrBy | Increases a variable by a specified number.
decrBy | Decreases a variable by a specified number.
incr | Executes incrBy with 1.
decr | Executes decrBy with 1.
del | Deletes all the specified entries.
delWithPattern | Deletes all the entries that fit the specified pattern.
empty | Deletes all entries.
publish | Sends a message to the specified channel.
subscribe | Listens to a specified channel.
unsubscribe | Stops listening to a specified channel.
close | Closes the connection.

## License

MIT © [Matías Puig](https://www.github.com/matipuig)
