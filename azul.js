/* Estudio Azul — las dos cosas que la página le pide al servidor.
   Sin dependencias y a prueba de que el elemento no exista en la página. */
(function () {
  "use strict";

  // Abierto de martes a domingo, 12 a 20, hora de Chile.
  var estado = document.getElementById("estado");
  if (estado) {
    try {
      var ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
      var dia = ahora.getDay(); // 0 domingo, 1 lunes
      var hora = ahora.getHours();
      var abierto = dia !== 1 && hora >= 12 && hora < 20;
      estado.textContent = abierto
        ? "Abierto ahora · hasta las 20:00"
        : "Martes a domingo · 12:00 a 20:00";
    } catch (e) { /* queda el horario escrito en el HTML */ }
  }

  // El recuento de la ronda sale del endpoint público de la votación.
  var votos = document.getElementById("votos");
  if (votos) {
    fetch("/votacion/api/estado")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.total === "number") votos.textContent = d.total; })
      .catch(function () { /* sin recuento, la ficha igual sirve */ });
  }

  // Los dibujos viven en pliegos aparte y entran al documento una vez. Se
  // piden por fetch en vez de repetir el dibujo en cada página: `<use>` no
  // alcanza archivos externos, así que el pliego tiene que estar adentro.
  // Cada página pide solo los que usa. Si una pedida falla, esos dibujos no
  // aparecen y la página sigue entera.
  [
    { prefijo: "#monito-", archivo: "/monitos.svg" },
    { prefijo: "#sabor-", archivo: "/sabores.svg" }
  ].forEach(function (pliego) {
    var usos = document.querySelectorAll('use[href^="' + pliego.prefijo + '"]');
    if (!usos.length) return;
    fetch(pliego.archivo)
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (txt) {
        if (!txt) return;
        var caja = document.createElement("div");
        caja.hidden = true;
        caja.innerHTML = txt;
        document.body.insertBefore(caja, document.body.firstChild);
        // Los `<use>` ya se parsearon apuntando a nada. Se les vuelve a
        // escribir el destino para que resuelvan contra el pliego recién
        // puesto, en vez de confiar en que el navegador lo reintente solo.
        Array.prototype.forEach.call(usos, function (u) {
          var destino = u.getAttribute("href");
          u.removeAttribute("href");
          u.setAttribute("href", destino);
        });
      })
      .catch(function () { /* la página se lee igual sin dibujos */ });
  });
})();
