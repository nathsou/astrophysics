export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.DuLpQ3FZ.js",app:"_app/immutable/entry/app.D5AC5sji.js",imports:["_app/immutable/entry/start.DuLpQ3FZ.js","_app/immutable/chunks/DCsia-jZ.js","_app/immutable/chunks/C1MU2Y5J.js","_app/immutable/entry/app.D5AC5sji.js","_app/immutable/chunks/C1MU2Y5J.js","_app/immutable/chunks/uBIymjUX.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/control-room/","/units/","/chapters/relativity-for-particles/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
