/**
 * Identifiants de clic Meta pour le site de vente.
 *
 * Pendant du module src/lib/meta.js de l'application. Meme logique, meme format
 * de cookie, meme domaine : un visiteur qui clique sur une publicite, atterrit
 * sur seances-athle.fr puis cree son compte sur app.seances-athle.fr reste la
 * meme personne aux yeux de Meta.
 *
 *   _fbc  construit a partir du parametre fbclid que Meta ajoute a l'URL quand
 *         quelqu'un clique sur une annonce. C'est le lien direct avec le clic,
 *         donc le plus precieux des deux.
 *   _fbp  identifiant de navigateur. Normalement pose par le pixel Meta. Comme
 *         il n'y a aucun script Facebook dans la page, il est fabrique a la
 *         premiere visite puis conserve tel quel.
 *
 * Aucun script tiers n'est charge, aucun cookie tiers n'est depose. Les
 * evenements partent vers une fonction serveur de l'application, qui les relaie
 * a l'API de conversions avec l'adresse IP et le navigateur lus dans les
 * en-tetes. Les bloqueurs de publicite ne voient rien a bloquer.
 *
 * Les evenements qui portent vraiment l'optimisation (Lead, CompleteRegistration,
 * Purchase) ne partent pas d'ici : ils partent des fonctions serveur qui les
 * constatent, email a l'appui.
 */
(function () {
  "use strict";

  var FONCTION = "https://app.seances-athle.fr/functions/metaCapi";
  var AN = 365 * 24 * 60 * 60;

  function racine() {
    var h = location.hostname || "";
    return h.indexOf("seances-athle.fr") !== -1 ? "; domain=.seances-athle.fr" : "";
  }

  function lire(nom) {
    var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + nom + "=([^;]+)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function ecrire(nom, valeur) {
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      nom + "=" + encodeURIComponent(valeur) +
      "; path=/; max-age=" + AN + "; SameSite=Lax" + secure + racine();
  }

  function initialiser() {
    try {
      var fbclid = new URLSearchParams(location.search).get("fbclid");
      if (fbclid) {
        // Format impose par Meta : fb.<sous-domaines>.<horodatage ms>.<fbclid>.
        // Le 1 correspond a un domaine de la forme exemple.fr.
        ecrire("_fbc", "fb.1." + Date.now() + "." + fbclid);
      }
      if (!lire("_fbp")) {
        ecrire("_fbp", "fb.1." + Date.now() + "." + Math.floor(Math.random() * 2147483647));
      }
    } catch (e) {
      /* navigation privee, cookies refuses : on continue sans */
    }
  }

  function identifiant(prefixe) {
    return prefixe + "." + Date.now() + "." + Math.floor(Math.random() * 1e9);
  }

  /**
   * Envoie un evenement. Les cookies ne voyagent pas toujours vers un autre
   * sous-domaine, alors on les joint au corps de la requete : la fonction
   * serveur accepte les deux sources.
   */
  function envoyer(nom) {
    try {
      var charge = JSON.stringify({
        nom: nom,
        idEvenement: identifiant(nom.toLowerCase()),
        url: location.href.slice(0, 500),
        fbp: lire("_fbp") || undefined,
        fbc: lire("_fbc") || undefined
      });

      fetch(FONCTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: charge,
        keepalive: true
      }).catch(function () {});
    } catch (e) {
      /* un evenement perdu ne doit jamais casser la page */
    }
  }

  initialiser();
  envoyer("PageView");

  /**
   * Les identifiants, mis a disposition du reste de la page. La pop-up de
   * capture s'en sert pour les joindre a l'appel vers leadMagnet : cet appel
   * part vers un autre sous-domaine, et un fetch inter-domaines n'emporte pas
   * les cookies. Sans ca, l'evenement Lead arrive chez Meta sans aucun lien
   * avec la publicite qui a amene la personne.
   */
  window.saMeta = {
    identifiants: function () {
      return { fbp: lire("_fbp") || undefined, fbc: lire("_fbc") || undefined };
    },
    envoyer: envoyer
  };

  // Un clic vers l'inscription est le dernier signal observable depuis le site
  // de vente. La creation de compte elle-meme est constatee par initUserTrial.
  document.addEventListener(
    "click",
    function (ev) {
      var lien = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!lien) return;
      var href = lien.getAttribute("href") || "";
      if (href.indexOf("/inscription") !== -1 || href.indexOf("app.seances-athle.fr") !== -1) {
        envoyer("InitiateCheckout");
      }
    },
    true
  );
})();
