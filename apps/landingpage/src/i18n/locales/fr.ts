import type { Dictionary } from "../types";
import home from "../home/fr";
import { SITE } from "@/config/site";
import { locales } from "../config";

const fr: Dictionary = {
  common: {
    backToHome: "Retour à l’accueil",
  },
  header: {
    product: "Produit",
    signIn: "Connexion",
    getStarted: "Commencer",
    bookDemo: "Demander une démo",
    company: "Entreprise",
    workWithUs: "Nous rejoindre",
    mission: "Notre mission",
    team: "Équipe",
    newsroom: "Actualités",
    careers: "Carrières",
    megaContactLabel: "Contact",
  },
  home,
  footer: {
    allRightsReserved: "Tous droits réservés.",
    cookiesSettings: "Cookies",
    termsOfService: "Conditions d’utilisation",
    privacyPolicy: "Politique de confidentialité",
    companyHeading: "Entreprise",
    mission: "Notre mission",
    team: "Équipe",
    newsroom: "Actualités",
    workWithUs: "Nous rejoindre",
    careers: "Carrières",
  },
  pages: {
    mission: {
      heading: "Notre mission",
      subheading:
        "Nous voulons que les techniciens passent leur temps sur les équipements, pas dans la paperasse.",
      body: [
        "Les vérifications des équipements de sécurité incendie protègent les personnes dans les bâtiments. Pourtant, dans beaucoup d’entreprises de maintenance, elles se font encore comme il y a vingt ans : le technicien fait le tour du bâtiment, note tout sur papier et passe sa soirée à recopier ses notes dans un rapport. Les prochaines échéances sont suivies dans un tableur ou de mémoire.",
        "Cela coûte du temps, de l’argent et de l’énergie. Une vérification oubliée, c’est un contrat perdu ; une note illisible, c’est une erreur dans le rapport ; et après un sinistre, il est difficile de prouver ce qui a été vérifié et quand.",
        "SparxDeck change cela. Le technicien scanne un QR code, coche la checklist, et le rapport est prêt. L’entreprise voit tous ses équipements, anomalies et échéances, et chaque vérification devient la prochaine intervention. Nous ne créons pas un énième logiciel d’entreprise complexe, mais un outil que l’on prend en main en quelques minutes et que l’on a plaisir à utiliser.",
      ],
    },
    about: {
      heading: "À propos de SparxDeck",
      subheading: "Un logiciel pour les entreprises de maintenance en sécurité incendie.",
      body: [
        "SparxDeck est une application web et mobile pour les entreprises qui effectuent les vérifications périodiques des équipements de sécurité incendie : extincteurs, poteaux et robinets d’incendie, éclairage de sécurité, clapets et portes coupe-feu. Elle remplace les notes papier et les tableurs par un seul outil clair.",
        `SparxDeck est né en Tchéquie et est conçu pour travailler dans plusieurs pays. Le cœur de l'application est partout le même ; la langue et les modèles de rapport changent. L'application existe pour l'instant en tchèque et en anglais, ce site en ${locales.length} langues.`,
        "Nous développons le produit en étroite collaboration avec des entreprises de maintenance et des techniciens de terrain. Si vous avez une idée qui vous faciliterait encore le travail, écrivez-nous.",
      ],
    },
    team: {
      heading: "L’équipe SparxDeck",
      subheading: "L’équipe qui construit un logiciel simple pour les entreprises de vérification.",
    },
    careers: {
      heading: "Carrières",
      subheading:
        "Nous n’avons pas de poste ouvert pour le moment. Si l’idée de créer un logiciel pour un secteur qui a besoin de se moderniser vous parle, écrivez-nous.",
    },
    news: {
      heading: "Actualités",
      subheading: "Pas encore d’actualités. Les premières mises à jour du produit apparaîtront bientôt ici.",
    },
    equipmentRegister: {
      heading: "Parc d’équipements et étiquettes QR",
      subheading: "Tous vos clients, bâtiments et équipements au même endroit",
      body: [
        "Dans SparxDeck, vous gérez vos clients, leurs bâtiments et chaque équipement dans une structure claire : extincteurs, poteaux et robinets d’incendie, éclairage de sécurité, clapets et portes coupe-feu. Pour chaque appareil, vous voyez le type, l’emplacement, la date de la dernière vérification et tout l’historique. Fini les recherches dans les classeurs ou entre plusieurs versions du même tableur.",
        "L’application imprime une étiquette QR pour chaque équipement. Le technicien la colle lors de la première visite ; ensuite, un seul scan suffit pour savoir devant quel appareil il se trouve et ce qu’il doit faire. Vos données existantes s’importent depuis Excel en quelques clics.",
      ],
    },
    fieldInspections: {
      heading: "Vérification sur le terrain au smartphone",
      subheading: "Scanner, cocher, terminé",
      body: [
        "Le technicien scanne le QR code de l’équipement et parcourt la checklist adaptée à ce type d’appareil, par exemple pour un extincteur : pression, scellé, dommages et date de validité. Chaque point est un simple oui/non : la vérification ne prend qu’un instant et rien n’est oublié.",
        "S’il trouve une anomalie, le technicien la photographie directement dans l’application. L’application fonctionne sans réseau au sous-sol ou en local technique, et les données se synchronisent dès que le téléphone est de nouveau en ligne. Aucun matériel spécial ni longue formation n’est nécessaire.",
      ],
    },
    inspectionReports: {
      heading: "Rapport prêt avant de repartir",
      subheading: "Signature sur écran et PDF automatique à votre logo",
      body: [
        "À la fin de la vérification, SparxDeck génère automatiquement un rapport PDF à partir de tout ce que le technicien a saisi sur le terrain. Le client le signe directement sur l’écran du téléphone. Le rapport porte le logo et les coordonnées de votre entreprise et liste les équipements vérifiés, les résultats et les anomalies relevées.",
        "Envoyez le rapport au client par e-mail d'un geste ; il reste enregistré dans le système. Vous réglez son apparence dans l'éditeur de modèles et un rapport émis ne change plus jamais. Vous retrouvez à tout moment ce qui a été vérifié, chez quel client et quand, par exemple lors d'un contrôle administratif ou d'un sinistre.",
      ],
    },
    deadlineTracking: {
      heading: "Suivi des échéances",
      subheading: "Aucune date n’est oubliée, chaque vérification amène la suivante",
      body: [
        "SparxDeck sait quand chaque équipement doit être vérifié à nouveau. Vous voyez au même endroit ce qui arrive à échéance le mois prochain, et le système vous rappelle les vérifications à venir en temps utile. Plus besoin de suivre les dates dans Excel ou de mémoire.",
        "Pour une entreprise de maintenance, cela signifie un flux régulier d’interventions récurrentes. Vous planifiez vos tournées à l’avance, vous contactez vos clients avant la concurrence et vous ne perdez plus de contrat parce qu’une date a été oubliée.",
      ],
    },
    defectTracking: {
      heading: "Anomalies sous contrôle",
      subheading: "Chaque anomalie détectée devient une tâche suivie jusqu’à sa résolution",
      body: [
        "Lorsqu’un technicien détecte une anomalie pendant une vérification, SparxDeck la transforme automatiquement en tâche avec photo et description. L’anomalie ne se perd pas dans les notes, et la personne responsable est clairement identifiée.",
        "Pour chaque défaut, vous voyez son statut (ouvert, en cours, résolu), qui s'en occupe et pour quand. La résolution exige une note et tout l'historique des modifications reste consultable. Vous savez que les problèmes trouvés sont vraiment traités, et vous avez la base de la prochaine intervention.",
      ],
    },
  },
  legal: {
    terms: {
      subheading:
        "Conditions d’utilisation du site et de l’application SparxDeck (résumé informatif, ne constitue pas un conseil juridique).",
      body: [
        `Les présentes conditions régissent l’utilisation du site et de l’application ${SITE.name}, une application web et mobile de gestion et de vérification des équipements de sécurité incendie. En vous inscrivant ou en utilisant l’application, vous les acceptez. Si vous utilisez l’application au nom d’une entreprise, vous confirmez y être autorisé.`,
        "L’application est proposée sous forme d’abonnement mensuel. Le prix suit la grille tarifaire en vigueur ou une offre individuelle et dépend du nombre de techniciens ou d’équipements. Vous pouvez résilier votre abonnement à tout moment, avec effet à la fin de la période payée.",
        "Vous êtes responsable de vos identifiants et de l’activité des utilisateurs de votre compte. Les données que vous saisissez dans l’application, notamment fichiers clients, équipements, photos et rapports, vous appartiennent. Nous les traitons uniquement pour fournir le service et vous les remettons sous forme d’export sur demande.",
        "SparxDeck est un outil de gestion et de documentation. La responsabilité de l’exécution professionnelle des vérifications et de l’exactitude des informations figurant dans les rapports incombe à l’entreprise de maintenance et à ses techniciens qualifiés.",
        "Nous nous efforçons d’assurer la disponibilité et la sécurité continues du service, sans pouvoir garantir l’absence de toute interruption ou erreur. Dans la mesure permise par la loi, notre responsabilité est limitée au montant des abonnements payés au cours des 12 derniers mois.",
        `Le logiciel, le design et la marque ${SITE.name} sont protégés par le droit d’auteur et d’autres droits de propriété intellectuelle. Il est interdit d’utiliser l’application de manière abusive, de contourner sa sécurité ou de l’utiliser en violation de la loi.`,
        `Les présentes conditions sont régies par le droit de la République tchèque. Nous pouvons les modifier et vous informerons à l’avance par e-mail de tout changement important. Pour toute question, écrivez-nous à ${SITE.email}.`,
      ],
    },
    privacy: {
      subheading:
        "Comment nous traitons les données personnelles sur le site et dans l’application SparxDeck (résumé informatif, ne constitue pas une analyse juridique).",
      body: [
        `Le responsable du traitement des données personnelles des utilisateurs et des visiteurs du site est l’exploitant du service ${SITE.name}. Pour toute question relative à la protection des données, contactez-nous à ${SITE.email}.`,
        "Nous traitons les données de votre compte (nom, e-mail, téléphone, entreprise), les données de facturation, les données techniques nécessaires à un fonctionnement sécurisé (adresse IP, type d’appareil, historique de connexion) et les informations que vous nous transmettez vous-même, par exemple lors d’une demande de démo.",
        "Les données qu’une entreprise de maintenance saisit dans l’application concernant ses clients, bâtiments, équipements et vérifications, y compris les photos et signatures, sont traitées par nous en qualité de sous-traitant pour le compte de cette entreprise. Les conditions de ce traitement figurent dans un accord de sous-traitance des données qui fait partie de l’abonnement.",
        "Nous traitons les données pour fournir le service et exécuter le contrat, pour respecter nos obligations légales (comptables notamment), sur la base de notre intérêt légitime (sécurité, prévention des abus, amélioration du service) et, pour les communications marketing, sur la base de votre consentement.",
        "Les données peuvent être traitées par des prestataires de confiance, tels que des fournisseurs d’infrastructure cloud, de services e-mail et de paiement, toujours sur la base de contrats garantissant leur protection conformément au RGPD. En cas de transfert hors de l’Espace économique européen, nous utilisons les clauses contractuelles types de la Commission européenne. Nous ne vendons pas les données personnelles.",
        "Nous conservons les données pendant la durée de votre compte, puis uniquement le temps nécessaire au respect de nos obligations légales ou à la défense de nos droits. À la fin de l’abonnement, nous exportons sur demande les données de votre entreprise, puis les supprimons.",
        "Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation du traitement, de portabilité et d’opposition. Vous pouvez retirer votre consentement à tout moment. Vous pouvez également introduire une réclamation auprès d’une autorité de protection des données.",
      ],
    },
    cookies: {
      subheading: "Les cookies et technologies similaires utilisés par le site et l’application SparxDeck.",
      body: [
        `Le site et l’application ${SITE.name} n’utilisent que les cookies nécessaires à leur fonctionnement. Nous n’utilisons pas de cookies publicitaires ou de suivi de tiers et nous ne vendons aucune information sur votre comportement.`,
        "Dans l’application, les cookies nécessaires maintiennent votre session ouverte et protègent votre compte contre les abus. Sur le site, nous enregistrons uniquement dans votre navigateur votre choix entre thème clair et thème sombre. La langue est déterminée par l’adresse de la page.",
        "Si nous utilisons des outils d’analyse ou d’autres cookies non strictement nécessaires, nous vous demanderons votre consentement au préalable et mettrons cette page à jour.",
        "Vous pouvez à tout moment supprimer ou bloquer les cookies dans les paramètres de votre navigateur, généralement dans la rubrique Confidentialité ou Sécurité. Sans les cookies nécessaires, vous ne pourrez toutefois pas vous connecter à l’application.",
        `Pour toute question sur l’utilisation des cookies, écrivez-nous à ${SITE.email}.`,
      ],
    },
  },
};

export default fr;
