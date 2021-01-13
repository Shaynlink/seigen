# Seigen

Seigen is a simple RateLimit Manager for express.

# Install
```bash
# npm
npm i shaynlink/seigen
# yarn
yarn shaynlink/seigen
```

# Docs

## RateLimit
#### RateLimit#rules
#### RateLimit#datas
#### RateLimit#maxRulesTimeout
#### RateLimit#middleware(request, response, next)
```js
app.use((req, res, next) => rt.middleware(req, res, next));
```
#### RateLimit#addRules(count, timeout, ban, message, filter);
```js
rt.addRules(5, 5e3, 5e3, 'Hello world');
```
#### (static) RateLimit#UUID()
```js
console.log(rt.UUID()); // -> 00000000-0000-0000-000000000000
```

# Exemples
### Simple usage
[click here, for get exemple file](https://github.com/Shaynlink/seigen/tree/main/test/index.js)
```js
'use strict';

const express = require('express');
const app = express();
const RateLimit = require('seigen');
const rt = new RateLimit();

rt.on('state', (user) => {
    console.log(`UUID: %s`, user.uuid);
});
rt.on('ban', console.log);
    
rt.addRules(5, 5e3, 5e3, 'You\'re not a king', (user, req) => req.headers['X-Auth'] != 'King');

app.use((req, res, next) => {
    req.start = Date.now();
    next();
});

app.use((...args) => rt.middleware(...args));

app.get('/', (req, res) => res.status(202).json({
    time: Date.now() - req.start,
}));

app.listen(3000);
```