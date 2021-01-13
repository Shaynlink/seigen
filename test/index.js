'use strict';

const express = require('express');
const app = express();
const RateLimit = require('./../src');
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