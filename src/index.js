'use strict';

const {
    EventEmitter
} = require('events');

/**
 * @typedef Options
 * 
 * @property {[Rules]} rules
 */

/**
 * @typedef Rules
 * 
 * @property {string} message
 * @property {[number, number, number]} tr - [count, ms, ms banned]
 * @property {Function} filter
 * @property {Object} any
 */

 /**
  * @typedef {ID}
  * 
  * @property {string} uuid
  * @property {boolean} ban
  * @property {number} banEnd
  * @property {number} remaining
  * @property {string} message
  */

class RateLimit extends EventEmitter {
    #ids = {}; // IDS is in private for most security
    /**
     * @param {Options} options
     */
    constructor(options = {}) {
        super();
        if (!options || typeof options != 'object') options = {};
        /**
         * @type {{[string]: ID}}
         */
        this.#ids = {};

        /**
         * @type {[Rules]}
         */
        this.rules = Array.isArray(options.rules) ?
            options.rules : [{
                message: 'Default ratelimit',
                // count - timeout - timeout banned
                tr: [10, 1e4, 2e4],
                filter: () => true,
                uuid: RateLimit.UUID(),
            }];

        /**
         * @type {{[string]: [number, number, number, NodeJS.Timeout]}}
         */
        this.datas = {};
    };

    /**
     * Return Rules index
     * @return {number}
     */
    get maxRulesTimeout() {
        return this.rules.findIndex(({tr: [value]}, index, arr) => {
            return arr.every(({tr: [_value]}) => _value <= value);
          });
    };

    /**
     * @param {Request} request 
     * @param {Response} response 
     * @param {NextFunction} next
     * @return {*}
     */
    async middleware(request, response, next) {       
        // Create new Identify 
        if (!this.#ids[request.ip]) this.#ids[request.ip] = {
            uuid: RateLimit.UUID(),
            ban: false,
            banEnd: 0,
            remaining: 0,
            message: '',
        };

        // Emit state event
        this.emit('state', this.#ids[request.ip], request);

        // If use is banned
        if (this.#ids[request.ip].ban) {
            // If time is out
            if (this.#ids[request.ip].banEnd < Date.now()) {
                // Reset ban data
                this.#ids[request.ip].ban = false;
                this.#ids[request.ip].banEnd =
                    this.#ids[request.ip].remaining = 0;
            } else {
                // Send ban data
                this.#ids[request.ip].remaining++;
                response.setHeader('X-RateLimit-Reset', this.#ids[request.ip].banEnd);
                response.setHeader('X-RateLimit-Reset-After', this.#ids[request.ip].banEnd - Date.now());
                response.setHeader('X-RateLimit-Reset', this.#ids[request.ip].banEnd);
                response.setHeader('X-RateLimit-Remaining', this.#ids[request.ip].remaining);
                response.setHeader('X-RateLimit-Message', this.#ids[request.ip].message);
                return response.status(429).json({
                    error: 'Time-out',
                    message: this.#ids[request.ip].message,
                    reset: this.#ids[request.ip].banEnd,
                    resetAfter: this.#ids[request.ip].banEnd - Date.now(),
                    remaining: this.#ids[request.ip].remaining,
                }).end();
            };
        } else {
            // garbage collector (Delete useless data)
            clearTimeout(this.#ids[request.ip].inactivity);
            this.#ids[request.ip].inactivity = setTimeout(() => delete this.#ids[request.ip], this.rules[this.maxRulesTimeout].tr[1]);
        };
        
        // Check all rules filtered
        for (const {uuid, tr, message} of this.rules.filter(({filter}) => filter(this.#ids[request.ip], request))) {
            // Create new ratelimit data
            const rateLimit = this.datas[uuid] ? this.datas[uuid] : this.datas[uuid] = {};

            // Create new user ratelimit data
            if (!rateLimit[this.#ids[request.ip].uuid]) rateLimit[this.#ids[request.ip].uuid] = [
                Date.now(),
                0,
                0,
                // garbage collector (delete useless data)
                setTimeout(() => delete rateLimit[this.#ids[request.ip].uuid], tr[1])
            ];

            // If ratelimit is up to date
            if ((rateLimit[this.#ids[request.ip].uuid][0] + tr[1]) > Date.now()) {
                rateLimit[this.#ids[request.ip].uuid][1]++;
                // If count exceeded
                if (rateLimit[this.#ids[request.ip].uuid][1] >= tr[0]) {
                    // Send ban data
                    this.#ids[request.ip].ban = true;
                    this.#ids[request.ip].banEnd = Date.now() + tr[2];
                    clearTimeout(this.#ids[request.ip].inactivity);
                    this.#ids[request.ip].inactivity = setTimeout(() => delete this.#ids[request.ip], tr[2]);
                    this.#ids[request.ip].message = message;
                    response.setHeader('X-RateLimit-Reset', this.#ids[request.ip].banEnd);
                    response.setHeader('X-RateLimit-Reset-After', this.#ids[request.ip].banEnd - Date.now());
                    response.setHeader('X-RateLimit-Reset', this.#ids[request.ip].banEnd);
                    response.setHeader('X-RateLimit-Remaining', this.#ids[request.ip].remaining);
                    response.setHeader('X-RateLimit-Message', this.#ids[request.ip].message);
                    response.status(429).json({
                        error: 'Time-out',
                        message,
                        reset: this.#ids[request.ip].banEnd,
                        resetAfter: this.#ids[request.ip].banEnd - Date.now(),
                        remaining: this.#ids[request.ip].remaining,
                    }).end();
                    // remit ban event
                    return this.emit('ban', this.#ids[request.ip], rateLimit);
                };
                // Reset user ratelimit data
            } else rateLimit[this.#ids[request.ip].uuid] = [Date.now(), 0, 1, setTimeout(() => delete rateLimit[this.#ids[request.ip].uuid], tr[1])];
        };

        // If all good, next
        next();
    };

    /**
     * Add new timeout rules
     * @param {number} count - Request count
     * @param {number} timeout - persistant timeout
     * @param {number} ban - Time banned
     * @param {string} message - Ratelimit message
     * @param {Function} filter - Ratelimit filter
     * @return {this}
     */
    addRules(count, timeout, ban, message, filter = () => true) {
        this.rules.push({tr: [count, timeout, ban], message, filter, uuid: RateLimit.UUID()});

        return this;
    };

    /**
     * Create UUID [improper]
     * @return {string}
     */
    static UUID() {
        const schema = [8, 4, 4, 12];
        let src = [];

        for (const i of schema) src.push(Math.floor(Math.random() * Number(`1e${i}`)));

        return src.join('-');
    };
};

module.exports = exports = RateLimit;