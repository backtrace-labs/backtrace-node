"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var backtraceClient_1 = require("./backtraceClient");
var backtraceClient;
var backtraceClient_2 = require("./backtraceClient");
exports.BacktraceClient = backtraceClient_2.BacktraceClient;
var backtraceReport_1 = require("./model/backtraceReport");
exports.BtReport = backtraceReport_1.BacktraceReport;
var backtraceClientOptions_1 = require("./model/backtraceClientOptions");
exports.BacktraceClientOptions = backtraceClientOptions_1.BacktraceClientOptions;
/**
 * Initalize Backtrace Client and Backtrace node integration
 * @param configuration Bcktrace configuration
 */
function initialize(configuration) {
    backtraceClient = new backtraceClient_1.BacktraceClient(configuration);
    return backtraceClient;
}
exports.initialize = initialize;
/**
 * Returns used BacktraceClient
 */
function getBacktraceClient() {
    return backtraceClient;
}
exports.getBacktraceClient = getBacktraceClient;
function use(client) {
    backtraceClient = client;
}
exports.use = use;
/**
 * Send report asynchronously to Backtrace
 * @param arg report payload
 * @param arg2 attributes
 * @param arg3 file attachments paths
 */
function report(arg, arg2, arg3) {
    if (arg2 === void 0) { arg2 = {}; }
    if (arg3 === void 0) { arg3 = []; }
    return __awaiter(this, void 0, void 0, function () {
        var data, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!backtraceClient) {
                        throw new Error('Must call initialize method first');
                    }
                    data = '';
                    if (arg instanceof Error || typeof arg === 'string') {
                        data = arg;
                    }
                    if (typeof arg === 'object' && arg2 === {}) {
                        arg2 = arg;
                    }
                    return [4 /*yield*/, backtraceClient.reportAsync(data, arg2, arg3)];
                case 1:
                    result = _a.sent();
                    if (arg instanceof Function) {
                        arg();
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}
exports.report = report;
/**
 * Send report synchronosuly to Backtrace
 * @param error report payload
 * @param reportAttributes attributes
 * @param attachments file attachments paths
 */
function reportSync(data, attributes, attachments) {
    if (attributes === void 0) { attributes = {}; }
    if (attachments === void 0) { attachments = []; }
    if (!backtraceClient) {
        throw new Error('Must call initialize method first');
    }
    return backtraceClient.reportSync(data, attributes, attachments);
}
exports.reportSync = reportSync;
/**
 * Generaten BacktraceReport with default configuration
 */
function createReport() {
    return BacktraceReport();
}
exports.createReport = createReport;
/**
 * Generaten BacktraceReport with default configuration
 */
function BacktraceReport() {
    if (!backtraceClient) {
        throw new Error('Must call initialize method first');
    }
    var backtraceReport = backtraceClient.createReport('');
    backtraceReport.send = function () {
        backtraceClient.sendReport(backtraceReport);
    };
    backtraceReport.sendSync = function () {
        backtraceClient.sendReport(backtraceReport);
    };
    return backtraceReport;
}
exports.BacktraceReport = BacktraceReport;
function errorHandlerMiddleware(err, req, resp, next) {
    if (!backtraceClient) {
        throw new Error('Must call initialize method first');
    }
    backtraceClient.reportSync(err, __assign({}, req, resp));
    next(err);
}
exports.errorHandlerMiddleware = errorHandlerMiddleware;
//# sourceMappingURL=index.js.map