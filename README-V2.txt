MATCH FR PWA — VERSION 2

Cette version récupère automatiquement les calendriers via GitHub Actions.

1) Crée un compte gratuit sur football-data.org et copie ton API token.
2) Dans GitHub : dépôt match-fr > Settings > Secrets and variables > Actions > New repository secret.
3) Nom : FOOTBALL_DATA_TOKEN ; valeur : ton token.
4) Remplace les fichiers de ton dépôt par ceux de ce dossier (garde la structure .github/workflows et scripts).
5) GitHub > Actions > "Mise à jour des matchs" > Run workflow.
6) Attends environ 1 minute puis recharge Match FR.
7) Ensuite, GitHub Actions relance automatiquement la collecte toutes les 6 heures.

Football : le script tente Ligue 1, Ligue 2, C1, Europa, Conference, Premier League, Liga, Serie A, Bundesliga. Certaines compétitions ne sont pas incluses dans le forfait gratuit football-data.org : elles seront ignorées proprement au lieu de casser l'app.
NBA : calendrier courant récupéré depuis le CDN public de NBA.com, sans clé.

Les diffuseurs français restent "à confirmer" dans cette V2 : il n'existe pas dans les sources utilisées ici de flux gratuit unique et fiable couvrant automatiquement toutes les chaînes françaises match par match.
