// ak sa skripty aplikácie nenačítajú (výpadok siete, blokovanie), indikátor načítania sa zmení na hlášku
(function () {
  var failed = false;
  var fail = function () {
    failed = true;
    var el = document.querySelector('#root .boot');
    if (!el) return;
    el.removeAttribute('role'); el.setAttribute('role', 'alert');
    el.innerHTML = '<b>Real machine tools</b><span>Nepodarilo sa načítať aplikáciu – skontroluj pripojenie na internet a stránku načítaj znova.<br>The application could not be loaded – check your internet connection and reload the page.</span>';
  };
  window.addEventListener('error', function (e) { if (e.target && e.target.tagName === 'SCRIPT') fail(); }, true);
  document.addEventListener('DOMContentLoaded', function () { if (failed) fail(); });   // skript v <head> zlyhá skôr, než existuje #root
  setTimeout(fail, 30000);
})();
