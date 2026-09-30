import "./server.js";
//#region src/lib/state/nav.svelte.ts
var Nav = class {
	sidebarOpen = false;
	/** Wide screens: the reader has folded the sidebar away. Remembered between visits. */
	sidebarCollapsed = false;
	/** Table of contents of the current page, for the sidebar. */
	toc = [];
	/** Id of the section currently in view. */
	activeId = null;
	/** Title of the current page, shown in the top bar once scrolled. */
	pageTitle = null;
	/** Pick up the state that app.html applied before first paint. */
	init() {
		this.sidebarCollapsed = document.documentElement.dataset.sidebar === "collapsed";
	}
	toggleCollapsed() {
		this.sidebarCollapsed = !this.sidebarCollapsed;
		if (this.sidebarCollapsed) document.documentElement.dataset.sidebar = "collapsed";
		else delete document.documentElement.dataset.sidebar;
		try {
			if (this.sidebarCollapsed) localStorage.setItem("particle-physics:sidebar", "collapsed");
			else localStorage.removeItem("particle-physics:sidebar");
		} catch {}
	}
};
var nav = new Nav();
//#endregion
export { nav as t };
