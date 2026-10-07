/* Loads the hero photo for the current screen size as soon as the hero markup exists. */
(function(){var mob=window.matchMedia("(max-width: 760px)").matches;window.__heroLoad=function(m){var i=document.querySelector(".hb-day img");if(i&&!i.src){i.fetchPriority="high";i.src=mob?i.dataset.m:i.dataset.d;}};window.__heroLoad(document.documentElement.getAttribute("data-mode"));})();
