/* Estudio Azul — las dos cosas que la página le pide al servidor.
   Sin dependencias y a prueba de que el elemento no exista en la página. */
(function () {
  "use strict";

  // El horario lo pone el Worker en atributos, desde lo que diga el panel. Si
  // no están —porque la base no contestó— no se toca nada y queda el horario
  // escrito en el HTML, que sigue siendo cierto.
  var estado = document.getElementById("estado");
  if (estado && estado.hasAttribute("data-abre")) {
    try {
      var abre = parseInt(estado.getAttribute("data-abre"), 10);
      var cierra = parseInt(estado.getAttribute("data-cierra"), 10);
      var diaCerrado = parseInt(estado.getAttribute("data-dia-cerrado"), 10);
      var dias = estado.getAttribute("data-dias") || "";
      var horas = estado.getAttribute("data-horas") || "";
      if (!isNaN(abre) && !isNaN(cierra)) {
        var ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
        var hora = ahora.getHours();
        var abierto = ahora.getDay() !== diaCerrado && hora >= abre && hora < cierra;
        estado.textContent = abierto
          ? "Abierto ahora · hasta las " + cierra + ":00"
          : dias + " · " + horas;
      }
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
  // Una página puede pedir un pliego por adelantado con
  // `<body data-pliegos="sabores">`. Hace falta cuando los `<use>` no existen
  // todavía al cargar porque los crea el guion después de una respuesta: sin
  // esto el pliego nunca se pediría y los dibujos no aparecerían nunca.
  var pedidos = (document.body.getAttribute("data-pliegos") || "").split(/\s+/);

  [
    { nombre: "monitos", prefijo: "#monito-", archivo: "/monitos.svg" },
    { nombre: "sabores", prefijo: "#sabor-", archivo: "/sabores.svg" }
  ].forEach(function (pliego) {
    var usos = document.querySelectorAll('use[href^="' + pliego.prefijo + '"]');
    if (!usos.length && pedidos.indexOf(pliego.nombre) === -1) return;
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
