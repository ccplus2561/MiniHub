/* 手機全螢幕偵測：遊戲視窗高度 ≈ 大廳視窗高度（頂端列已收合、底部導覽列已隱藏）時，
   在 <html> 加上 .mfs，由 style.css 套用「分數置頂」版面。非全螢幕維持原本版面。 */
(function () {
  "use strict";
  var P = null;
  try { if (parent !== window && parent.document) P = parent; } catch (e) {}
  var de = document.documentElement;
  function check() {
    var fs = false;
    if (innerWidth <= 760) {
      /* 三種判斷任一成立即視為全螢幕：高度接近大廳視窗、或螢幕高度、或畫面夠細長（非全螢幕約 1.3，全螢幕約 2.1） */
      fs = innerHeight / innerWidth > 1.65;
      try { if (P && innerHeight >= P.innerHeight - 6) fs = true; } catch (e) {}
      try { if (innerHeight >= screen.height * 0.9) fs = true; } catch (e) {}
    }
    de.classList.toggle("mfs", fs);
  }
  addEventListener("resize", check);
  addEventListener("orientationchange", function () { setTimeout(check, 200); });
  try { if (P) P.addEventListener("resize", check); } catch (e) {}
  document.addEventListener("fullscreenchange", check);
  check();
  setTimeout(check, 300);   // 全螢幕切換動畫結束後再校正一次
  setTimeout(check, 900);
})();
