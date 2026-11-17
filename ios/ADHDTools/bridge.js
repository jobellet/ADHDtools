// Injected by WebView.swift before the page's own scripts. Gives the web app the same
// window.__TAURI__.core.invoke API as the desktop app, answered by NativeBridge.swift
// through the "adhdBridge" WKScriptMessageHandler.
(function () {
  if (window.__TAURI__ || !window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.adhdBridge) return;
  var handler = window.webkit.messageHandlers.adhdBridge;
  var pending = {};
  var nextId = 1;

  window.__ADHD_IOS_BRIDGE_CALLBACK__ = function (msg) {
    var call = pending[msg.id];
    if (!call) return;
    delete pending[msg.id];
    if (msg.ok) call.resolve(msg.value === undefined ? null : msg.value);
    else call.reject(new Error(msg.error || 'failed'));
  };

  function invoke(cmd, args) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      handler.postMessage(JSON.stringify({ id: id, cmd: cmd, args: args || {} }));
    });
  }

  window.__TAURI__ = { core: { invoke: invoke } };
  window.__ADHD_IOS__ = true;

  // Export buttons make <a download href="blob:…"> links, which a WKWebView cannot save.
  // Keep each blob, and hand its bytes to the iOS share sheet instead (ios_save_file).
  var blobs = {};
  var createObjectURL = URL.createObjectURL;
  var revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = function (obj) {
    var url = createObjectURL.call(URL, obj);
    if (obj instanceof Blob) blobs[url] = obj;
    return url;
  };
  URL.revokeObjectURL = function (url) {
    setTimeout(function () { delete blobs[url]; revokeObjectURL.call(URL, url); }, 60000);
  };

  function dataUrlToBlob(href) {
    var comma = href.indexOf(',');
    var meta = href.slice(5, comma);
    var payload = href.slice(comma + 1);
    var type = meta.split(';')[0] || 'text/plain';
    var text = /;base64/.test(meta) ? atob(payload) : decodeURIComponent(payload);
    var bytes = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: type });
  }

  function save(link) {
    var href = link.getAttribute('href') || '';
    if (!link.hasAttribute('download')) return false;
    var blob = blobs[href] || (/^data:/.test(href) ? dataUrlToBlob(href) : null);
    if (!blob) return false;
    var reader = new FileReader();
    reader.onload = function () {
      invoke('ios_save_file', {
        name: link.getAttribute('download') || 'download',
        mime: blob.type || 'application/octet-stream',
        base64: String(reader.result).split(',')[1] || '',
      }).catch(function (err) { console.warn('Save failed', err); });
    };
    reader.readAsDataURL(blob);
    return true;
  }

  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!save(this)) click.call(this);
  };
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[download]') : null;
    if (link && save(link)) event.preventDefault();
  }, true);
})();
