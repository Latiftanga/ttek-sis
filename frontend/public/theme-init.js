(function () {
  try {
    var ts = localStorage.getItem("ttek-theme");
    var t = ts ? JSON.parse(ts).state?.theme : "system";
    var d =
      t === "dark" ||
      (t !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (d) document.documentElement.classList.add("dark");
    var as = localStorage.getItem("ttek-auth");
    var brand = as ? JSON.parse(as).state?.school?.accent_color : null;
    if (brand) document.documentElement.style.setProperty("--brand", brand);
  } catch (e) {}
})();
