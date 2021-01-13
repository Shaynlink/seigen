declare module seigen {
    import {
        Request,
        Response,
        NextFunction
    } from 'express';

    //#region 

    export interface Options {
        rules: [Rules];
    };

    export interface Rules {
        message: string;
        tr: [number, number, number];
        filter: (id: ID, request: Request) => boolean;
    };

    export interface ID {
        uuid: string;
        ban: boolean;
        banEnd: number;
        remaining: number;
        message: string;
    };

    interface Objects<T, S> {
        [T]: S;
    };

    export class RateLimit {
        constructor(options: Options);

        private #ids: Objects<string, ID>;
        
        public rules: [Rules];
        public datas: Objects<string, [number, number, number, NodeJS.Timeout]>;

        public get maxRulesTimeout(): number;

        public middlewate(request: Request, response: Response, next: NextFunction): any;
        public addRules(count: number, timeout: number, ban: number, message: string, filter: (id: ID, request: Request) => boolean): this;

        public static UUID(): string;
    };

    //#endregion
};