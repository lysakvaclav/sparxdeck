import type { HomeDictionary } from "../types";

// The home page in this language (sections of src/app/[locale]/page.tsx).
const home: HomeDictionary = {
  "hero": {
    "eyebrow": "Logiciel pour la vérification des équipements de sécurité incendie",
    "title": "Le système complet pour les vérifications incendie.",
    "body": "Un logiciel conçu pour les entreprises de maintenance. Registre des équipements, étiquettes QR, planning et tournées des techniciens, contrôles sur téléphone, rapports, anomalies et échéances au même endroit.",
    "cta": "Demander une démo"
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
        "question": "Combien coûte SparxDeck ?",
        "answer": "Le prix est convenu selon la taille de votre entreprise. Le paiement se fait par virement sur la base d’un contrat, et vos clients ne paient rien. Réservez une courte démonstration et nous vous préparerons une offre."
      },
      {
        "question": "Quels avantages apporte SparxDeck ?",
        "answer": "Le technicien ne recopie plus ses vérifications le soir : il scanne l’étiquette QR, coche le contrôle sur son téléphone et le rapport est créé directement à partir des données saisies. Les échéances et les anomalies ouvertes sont suivies par le système au lieu d’Excel, et tous les rapports ont la même présentation avec votre logo. Moins de papier, moins de ressaisie et moins d’erreurs."
      },
      {
        "question": "Sur quels appareils fonctionne SparxDeck ?",
        "answer": "Il fonctionne dans le navigateur sur iPhone, Android et ordinateur, sans rien installer depuis une boutique d’applications. Sur le téléphone, vous l’ajoutez à l’écran d’accueil comme une application. Il fonctionne aussi sans réseau : un contrôle en cours, les photos et les bâtiments visités sont enregistrés sur le téléphone et envoyés dès que la connexion revient."
      },
      {
        "question": "En quoi SparxDeck diffère-t-il d’Excel ou des systèmes généralistes ?",
        "answer": "Il est conçu spécifiquement pour la vérification des équipements de sécurité incendie, et non adapté d’un logiciel généraliste d’interventions. Il propose des étiquettes QR, des listes de contrôle par type d’équipement, le suivi des anomalies, les échéances, les plans des bâtiments et une carte. Il ne gère ni devis ni facturation, ce qui le garde simple."
      },
      {
        "question": "Comment reprendre mes données actuelles et connecter d’autres systèmes ?",
        "answer": "Importez clients, bâtiments et équipements depuis un fichier Excel ou CSV. L’application reconnaît elle-même les colonnes, affiche un aperçu avant l’enregistrement, et l’import entier peut être annulé. Vous pouvez exporter les données en CSV à tout moment. Il n’existe pas encore de connexion directe aux logiciels comptables."
      },
      {
        "question": "En combien de temps pouvons-nous démarrer ?",
        "answer": "Tout de suite. Vous créez le compte vous-même et testez tout sur des données d’exemple. Importez vos données depuis un fichier, imprimez les étiquettes QR, et un technicien réalise son premier contrôle sans longue formation."
      },
      {
        "question": "Comment SparxDeck protège-t-il les données ?",
        "answer": "Les données de chaque entreprise sont séparées de toutes les autres, et l’accès dépend des rôles : propriétaire, administrateur et technicien. Un rapport émis n’est jamais écrasé ; corriger une vérification crée une nouvelle version et l’original reste conservé."
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
  },
  "mcp": {
    "title": "SparxDeck MCP.",
    "titleRest": "Vos vérifications dans votre assistant IA.",
    "body": "Connectez SparxDeck à ChatGPT, Claude ou Gemini et posez vos questions simplement : ce qui arrive à échéance le mois prochain, quelles anomalies sont en retard ou où un technicien se rend demain. La réponse vient directement de vos données.",
    "question": "Qu’est-ce qui arrive à échéance le mois prochain ?",
    "answer": "En novembre, 16 équipements dans 4 bâtiments arrivent à échéance. D’abord l’immeuble Lipová 12, le 3 novembre.",
    "cta": "Demander une démo"
  }
};

export default home;
