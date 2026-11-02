import type { McpPageDictionary } from "../types";

// The public MCP page in this language (src/app/[locale]/mcp/page.tsx).
const mcp: McpPageDictionary = {
  "title": "SparxDeck MCP",
  "subtitle": "Vérifications, échéances et anomalies directement dans votre assistant IA.",
  "intro": "SparxDeck MCP relie les données de votre entreprise aux assistants IA comme Claude, ChatGPT ou Gemini grâce au standard ouvert Model Context Protocol. Posez vos questions simplement : l’assistant répond à partir de vos vraies données.",
  "connectTitle": "Comment se connecter",
  "address": "Adresse du serveur",
  "steps": [
    "Le propriétaire de l’entreprise active les assistants IA dans l’application SparxDeck, rubrique Assistants IA. Les modifications de données s’autorisent séparément.",
    "Dans votre assistant, ajoutez un connecteur personnalisé (serveur MCP distant) avec l’adresse ci-dessus.",
    "Connectez-vous à SparxDeck, choisissez l’entreprise et autorisez l’accès. Vous pouvez le révoquer à tout moment."
  ],
  "note": "Les assistants qui ne se connectent pas par OAuth utilisent un jeton personnel créé dans l’application.",
  "toolsTitle": "Ce que l’assistant sait faire",
  "readTitle": "Lecture",
  "readGroups": [
    "Vue d’ensemble et échéances",
    "Bâtiments et clients",
    "Équipements",
    "Vérifications et synthèses",
    "Anomalies et visites prévues",
    "Recherche et listes"
  ],
  "writeTitle": "Modifications, seulement si le propriétaire les autorise",
  "writeBody": "Chaque modification se fait en deux temps : l’assistant montre d’abord un aperçu et ne l’exécute qu’après votre confirmation explicite.",
  "writeGroups": [
    "Anomalies",
    "Planning des visites",
    "Notes"
  ],
  "extras": "Sont aussi disponibles des ressources (entreprise, types d’équipements, détail d’un bâtiment, d’un équipement, d’une anomalie et d’une vérification) et des consignes prêtes à l’emploi : plan des prochains jours, rapport pour un client, préparation d’une visite et revue des anomalies ouvertes.",
  "securityTitle": "Sécurité",
  "security": [
    "Désactivé par défaut. Le propriétaire l’active et autorise les modifications séparément.",
    "L’assistant a les mêmes droits que le membre qui l’a connecté, avec les mêmes règles d’accès que l’application.",
    "Chaque modification doit être confirmée explicitement. Rien n’est supprimé et aucun rapport n’est émis.",
    "La position des techniciens et leur domicile ne sont jamais montrés à l’assistant.",
    "Les textes issus des données arrivent à l’assistant marqués comme données, pas comme instructions.",
    "Chaque appel est enregistré (qui, quand, quel outil) et vous voyez le récapitulatif dans l’application.",
    "Le nombre d’appels est limité, les jetons expirent et vous pouvez révoquer une connexion à tout moment."
  ],
  "technicalTitle": "Détails techniques",
  "technical": [
    "Model Context Protocol 2026-07-28 via Streamable HTTP ; les anciens clients de 2025 sont aussi pris en charge.",
    "OAuth 2.1 avec PKCE (S256), enregistrement dynamique des clients et Client ID Metadata Documents, jetons liés à ce serveur (RFC 8707).",
    "Portées sparxdeck:read et sparxdeck:write.",
    "Outils avec descriptions, schémas d’entrée et de sortie, annotations (lecture seule, destructif, idempotent) et pagination."
  ]
};

export default mcp;
