/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
define(["require", "exports", "vs/base/common/platform", "vs/base/common/worker/simpleWorker"], function (require, exports, platform_1, simpleWorker_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function getWorker(workerId, label) {
        // Option for hosts to overwrite the worker script (used in the standalone editor)
        if (platform_1.globals.MonacoEnvironment) {
            if (typeof platform_1.globals.MonacoEnvironment.getWorker === 'function') {
                return platform_1.globals.MonacoEnvironment.getWorker(workerId, label);
            }
            if (typeof platform_1.globals.MonacoEnvironment.getWorkerUrl === 'function') {
                return new Worker(platform_1.globals.MonacoEnvironment.getWorkerUrl(workerId, label));
            }
        }
        // ESM-comment-begin
        if (typeof require === 'function') {
            // check if the JS lives on a different origin
            const workerMain = require.toUrl('./' + workerId);
            const workerUrl = getWorkerBootstrapUrl(workerMain, label);
            return new Worker(workerUrl, { name: label });
        }
        // ESM-comment-end
        throw new Error(`You must define a function MonacoEnvironment.getWorkerUrl or MonacoEnvironment.getWorker`);
    }
    function getWorkerBootstrapUrl(scriptPath, label) {
        if (/^(http:)|(https:)|(file:)/.test(scriptPath)) {
            const currentUrl = String(window.location);
            const currentOrigin = currentUrl.substr(0, currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length);
            if (scriptPath.substring(0, currentOrigin.length) !== currentOrigin) {
                // this is the cross-origin case
                // i.e. the webpage is running at a different origin than where the scripts are loaded from
                const myPath = 'vs/base/worker/defaultWorkerFactory.js';
                const workerBaseUrl = require.toUrl(myPath).slice(0, -myPath.length);
                const js = `/*${label}*/self.MonacoEnvironment={baseUrl: '${workerBaseUrl}'};importScripts('${scriptPath}');/*${label}*/`;
                const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`;
                return url;
            }
        }
        return scriptPath + '#' + label;
    }
    exports.getWorkerBootstrapUrl = getWorkerBootstrapUrl;
    function isPromiseLike(obj) {
        if (typeof obj.then === 'function') {
            return true;
        }
        return false;
    }
    /**
     * A worker that uses HTML5 web workers so that is has
     * its own global scope and its own thread.
     */
    class WebWorker {
        constructor(moduleId, id, label, onMessageCallback, onErrorCallback) {
            this.id = id;
            const workerOrPromise = getWorker('workerMain.js', label);
            if (isPromiseLike(workerOrPromise)) {
                this.worker = workerOrPromise;
            }
            else {
                this.worker = Promise.resolve(workerOrPromise);
            }
            this.postMessage(moduleId, []);
            this.worker.then((w) => {
                w.onmessage = function (ev) {
                    onMessageCallback(ev.data);
                };
                w.onmessageerror = onErrorCallback;
                if (typeof w.addEventListener === 'function') {
                    w.addEventListener('error', onErrorCallback);
                }
            });
        }
        getId() {
            return this.id;
        }
        postMessage(message, transfer) {
            if (this.worker) {
                this.worker.then(w => w.postMessage(message, transfer));
            }
        }
        dispose() {
            if (this.worker) {
                this.worker.then(w => w.terminate());
            }
            this.worker = null;
        }
    }
    class DefaultWorkerFactory {
        constructor(label) {
            this._label = label;
            this._webWorkerFailedBeforeError = false;
        }
        create(moduleId, onMessageCallback, onErrorCallback) {
            let workerId = (++DefaultWorkerFactory.LAST_WORKER_ID);
            if (this._webWorkerFailedBeforeError) {
                throw this._webWorkerFailedBeforeError;
            }
            return new WebWorker(moduleId, workerId, this._label || 'anonymous' + workerId, onMessageCallback, (err) => {
                simpleWorker_1.logOnceWebWorkerWarning(err);
                this._webWorkerFailedBeforeError = err;
                onErrorCallback(err);
            });
        }
    }
    DefaultWorkerFactory.LAST_WORKER_ID = 0;
    exports.DefaultWorkerFactory = DefaultWorkerFactory;
});
//# sourceMappingURL=defaultWorkerFactory.js.map