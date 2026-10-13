/** Apply a saved appearance choice before React hydration to avoid a theme flash.
 * This script never reads account data or makes network requests.
 */
export const themeInitScript = `(function(){
  var root = document.documentElement;
  var key = "skilltwin-theme";
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function sync(){
    var value = "system";
    try { var stored = window.localStorage.getItem(key); if(stored==="light"||stored==="dark"||stored==="system")value=stored; } catch(_error){}
    root.dataset.themePreference=value;
    root.dataset.theme=value==="system"?(media.matches?"dark":"light"):value;
  }
  sync();
  if(media.addEventListener)media.addEventListener("change",sync);
  else if(media.addListener)media.addListener(sync);
  window.addEventListener("storage",function(event){if(event.key===key||event.key===null)sync();});
})();`;
