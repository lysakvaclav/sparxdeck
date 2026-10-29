import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Logiciel pour la vérification des équipements de sécurité incendie",
    "title": "Vérifications incendie.",
    "titleMuted": "Sans papier ni ressaisie.",
    "body": "SparxDeck est une application pour les entreprises de maintenance qui vérifient extincteurs, bouches d'incendie, éclairage de sécurité, clapets et portes coupe-feu. Le technicien scanne une étiquette QR, valide le contrôle sur son téléphone et le rapport est prêt sur place. Les prochaines échéances sont suivies par le système, plus par un tableur.",
    "primary": "Commencer avec SparxDeck",
    "secondary": "Demander une démo",
    "note": "Fonctionne dans le navigateur, sur ordinateur et téléphone. Rien à installer."
  },
  "facts": [
    {
      "value": "1 scan",
      "label": "et le technicien voit la fiche de l'équipement et sa liste de contrôle"
    },
    {
      "value": "Sans réseau",
      "label": "le contrôle et le plan du jour fonctionnent même en sous-sol"
    },
    {
      "value": "PDF sur place",
      "label": "un rapport signé par le client juste après le contrôle"
    },
    {
      "value": "Quelques minutes",
      "label": "pour former un technicien au lieu d'une journée"
    }
  ],
  "platform": {
    "eyebrow": "Plateforme",
    "title": "Tout ce dont une entreprise de vérification a besoin. Rien de plus.",
    "body": "Du registre des équipements au contrôle sur site, jusqu'au rapport signé, aux défauts et à la prochaine échéance. Un seul système pour le bureau et les techniciens.",
    "learnMore": "En savoir plus"
  },
  "features": [
    {
      "label": "Registre des équipements",
      "title": "Clients, bâtiments et équipements au même endroit",
      "body": "Extincteurs, bouches d'incendie, éclairage de sécurité, clapets et portes avec emplacement, numéro de série et tout l'historique des contrôles. Importez votre tableau Excel actuel et imprimez les étiquettes QR directement depuis l'application."
    },
    {
      "label": "Contrôle sur site",
      "title": "Scanner, valider, terminé",
      "body": "Le technicien scanne l'étiquette et suit la liste de contrôle propre au type d'équipement, en photographiant les défauts. Sans réseau, le contrôle attend dans le téléphone et part dès que la connexion revient."
    },
    {
      "label": "Rapports",
      "title": "Le rapport est prêt avant de partir",
      "body": "Un PDF avec le logo de votre entreprise et la signature du client est créé juste après le contrôle et envoyé par e-mail d'un geste. Vous réglez son apparence dans l'éditeur de modèles. Un rapport émis ne change plus jamais."
    },
    {
      "label": "Échéances",
      "title": "Aucune vérification n'est oubliée",
      "body": "Le calendrier montre ce qui arrive à échéance et qui va où. Une vue à 30, 60 et 90 jours et un récapitulatif hebdomadaire par e-mail surveillent les dates pour vous."
    },
    {
      "label": "Défauts",
      "title": "Des défauts suivis jusqu'à leur résolution",
      "body": "Un point de contrôle non conforme devient un défaut avec photo, gravité, responsable et délai. Chaque modification est inscrite dans l'historique."
    },
    {
      "label": "Carte et tournées",
      "title": "Les bâtiments sur une carte, les visites triées par distance",
      "body": "La carte montre l'état de chaque bâtiment. Une tournée ordonne les visites de la journée et propose les bâtiments proches dont la vérification approche. Les distances sont à vol d'oiseau, ce n'est pas de la navigation."
    }
  ],
  "principles": {
    "eyebrow": "Pourquoi SparxDeck",
    "title": "Conçu pour le travail sur le terrain",
    "items": [
      {
        "title": "Simple",
        "body": "Seulement ce dont un technicien a vraiment besoin. Pas de système d'entreprise complexe, pas de longue formation."
      },
      {
        "title": "Fonctionne sans réseau",
        "body": "Contrôles, photos et plan du jour attendent dans le téléphone et partent dès qu'il y a une connexion."
      },
      {
        "title": "Vos données restent à vous",
        "body": "Chaque entreprise ne voit que ses propres données. Export CSV à tout moment ; les rapports émis restent inchangés."
      }
    ]
  },
  "steps": {
    "eyebrow": "Fonctionnement",
    "title": "Une vérification en cinq étapes",
    "items": [
      "Vous créez vos clients, bâtiments et équipements, ou vous les importez depuis votre tableau actuel.",
      "Vous imprimez les étiquettes QR ; le technicien les colle sur les équipements lors de la première visite.",
      "À chaque contrôle, le technicien scanne l'étiquette et valide la liste sur son téléphone.",
      "Un point non conforme est enregistré comme défaut avec photo et délai.",
      "Le client signe sur l'écran, le rapport part par e-mail et la prochaine échéance est fixée."
    ]
  },
  "comparison": {
    "eyebrow": "Comparaison",
    "title": "Papier et Excel vs. SparxDeck",
    "body": "Comment chaque étape d'une vérification change quand carnets, classeurs et tableaux laissent place à une seule application.",
    "oldLabel": "Papier et Excel",
    "newLabel": "SparxDeck",
    "rows": [
      {
        "topic": "Relevé du contrôle",
        "old": "À la main sur papier, souvent illisible",
        "new": "Scan de l'étiquette QR et liste sur le téléphone"
      },
      {
        "topic": "Rapport",
        "old": "Ressaisie le soir dans Word ou Excel",
        "new": "PDF signé par le client sur place"
      },
      {
        "topic": "Échéances",
        "old": "Tableur, agenda ou mémoire",
        "new": "Vue des échéances et récapitulatif hebdomadaire"
      },
      {
        "topic": "Défauts",
        "old": "Une note dans la marge qui se perd",
        "new": "Défaut avec photo, responsable et délai"
      },
      {
        "topic": "Historique",
        "old": "Classeurs et recherche dans les dossiers",
        "new": "Tout l'historique d'un équipement en un geste"
      },
      {
        "topic": "Planification",
        "old": "De mémoire et à l'expérience",
        "new": "Calendrier, carte des bâtiments et tournée du jour"
      }
    ]
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Questions fréquentes",
    "body": "Vous n'avez pas trouvé votre réponse ? Écrivez-nous, nous vous montrerons SparxDeck avec plaisir.",
    "items": [
      {
        "question": "À qui s'adresse SparxDeck ?",
        "answer": "Aux entreprises de maintenance qui vérifient et testent les équipements de sécurité incendie, généralement de 3 à 30 personnes. Les techniciens travaillent sur téléphone, le bureau sur ordinateur."
      },
      {
        "question": "Quels équipements SparxDeck prend-il en charge ?",
        "answer": "Extincteurs, bouches d'incendie, éclairage de sécurité, clapets et portes coupe-feu. Vous adaptez les types d'équipement et leurs points de contrôle, pour que le technicien vérifie exactement ce qu'il faut."
      },
      {
        "question": "L'application fonctionne-t-elle sans réseau ?",
        "answer": "Oui. Une vérification en cours et le plan du jour sont enregistrés dans le téléphone. Contrôles, photos et bâtiments visités y attendent et partent dès qu'il y a une connexion."
      },
      {
        "question": "Puis-je adapter le rapport ?",
        "answer": "Oui. Dans l'éditeur de modèles, vous réglez blocs, textes, logo, police et couleur. Ce que le rapport doit contenir selon la réglementation relève de votre entreprise ; l'application n'invente aucune règle. Un rapport émis ne change plus."
      },
      {
        "question": "Comment reprendre mes données actuelles ?",
        "answer": "Importez clients, bâtiments et équipements depuis un fichier Excel ou CSV. L'application reconnaît les colonnes, affiche un aperçu avant l'enregistrement et un import peut être annulé."
      },
      {
        "question": "Combien coûte SparxDeck ?",
        "answer": "Le prix est convenu selon la taille de votre entreprise et réglé par virement dans le cadre d'un contrat. Demandez une courte démo et nous vous préparerons une offre."
      },
      {
        "question": "Combien de temps pour la prise en main ?",
        "answer": "Quelques minutes. Un technicien réalise son premier contrôle sans formation, et l'application contient des données d'exemple pour tout essayer."
      }
    ]
  },
  "cta": {
    "title": "Essayez SparxDeck dans votre entreprise",
    "body": "Créez un compte et découvrez l'application sur des données d'exemple, ou demandez une courte démo.",
    "primary": "Commencer avec SparxDeck",
    "secondary": "Demander une démo"
  },
  "shots": {
    "dashboard": "Vue d'ensemble SparxDeck avec échéances, défauts et tournée du jour",
    "devices": "Liste des équipements avec étiquettes, emplacements et échéances",
    "check": "Contrôle d'un extincteur sur téléphone",
    "protocol": "Éditeur de modèle de rapport avec aperçu PDF",
    "calendar": "Calendrier des vérifications planifiées",
    "defects": "Liste des défauts avec gravité et délai",
    "map": "Carte des bâtiments selon l'état des échéances",
    "route": "Tournée d'un technicien sur la carte, triée par distance",
    "today": "Plan du jour d'un technicien sur téléphone"
  }
};

export default home;
