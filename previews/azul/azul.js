/* Estudio Azul — las dos cosas que la franja necesita saber.
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
})();
