/* Runs in <head> before first paint: the page theme is set only by the toggle (saved in localStorage), never by the OS. */
(function(){var m="light";try{var s=localStorage.getItem("tc-mode");if(s==="dark"||s==="light")m=s;}catch(e){}document.documentElement.setAttribute("data-mode",m);})();
