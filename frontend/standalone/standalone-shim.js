/* Adapted for Spotify 01.007.000 (PPSA05688), frontend bundle ad3ec52.
   UNTESTED on real hardware - built from structural analysis of the
   01.007.000 bundle only, not from Spotify's source or any upstream fix.
   Installed inside Spotify's module, after fG, vG, CG and mG are defined
   (the 01.007.000 analogs of BaseSessions, Ps5Sessions, SonyLinker and
   Session). Logic is unchanged from the 01.017.000 shim; only the call
   site below binds the differently-named classes found in this bundle. */
(function installStandaloneAuth(BaseSessions, Ps5Sessions, SonyLinker, Session, done, root) {
    "use strict";
    function enabled() { return root.__spotifyStandaloneAuth === true; }
    function currentAuthenticated(handler, bridge) {
        var profile = handler.userProfileFetcher.getCurrentUser();
        var id = handler.userProfileFetcher.getCurrentUserId();
        return !!(bridge &&
            bridge === handler._bridgeSessionsHandler.sessionObservable.getState() &&
            typeof bridge.getAccessToken === "function" && bridge.transport &&
            typeof id === "string" && id.length && profile &&
            profile.id === id && bridge.userId === id);
    }
    var originalTryLinked = BaseSessions.prototype._tryLoginLinkedUser;
    BaseSessions.prototype._tryLoginLinkedUser = function () {
        if (!enabled()) return originalTryLinked.apply(this, arguments);
        this._latestLinkingError = null;
        return this._bridgeSessionsHandler.checkLoggedInUser();
    };
    var originalOnSession = BaseSessions.prototype.onBridgeSession;
    BaseSessions.prototype.onBridgeSession = function (bridge) {
        if (!enabled() || bridge === null) {
            return originalOnSession.apply(this, arguments);
        }
        if (bridge !== this._bridgeSessionsHandler.sessionObservable.getState()) {
            return Promise.resolve();
        }
        if (!currentAuthenticated(this, bridge)) {
            return Promise.reject(new Error("Standalone session lacks authenticated Spotify profile"));
        }
        var session = new Session(bridge, false, false, this._authGen.get,
            this._logout, this.userProfileFetcher);
        session.isStandaloneAuth = true;
        this._latestLinkingError = null;
        return this.sessionObservable.set(session).then(done);
    };
    var originalRetry = Ps5Sessions.prototype._retryLoginLinkedUserLoop;
    Ps5Sessions.prototype._retryLoginLinkedUserLoop = function () {
        if (!enabled()) return originalRetry.apply(this, arguments);
        this._latestLinkingError = null;
        return Promise.resolve();
    };
    var originalRegisterFocus = Ps5Sessions.prototype._registerOnFocusListenerOnce;
    Ps5Sessions.prototype._registerOnFocusListenerOnce = function () {
        if (!enabled()) return originalRegisterFocus.apply(this, arguments);
    };
    ["get", "link", "unlink"].forEach(function (method) {
        var original = SonyLinker.prototype[method];
        SonyLinker.prototype[method] = function () {
            if (!enabled()) return original.apply(this, arguments);
            if (method === "get") return Promise.resolve(null);
            return Promise.reject(new Error("Sony account linking disabled in standalone mode"));
        };
    });
})(fG, vG, CG, mG, cG, window);
