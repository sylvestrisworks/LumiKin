"""One-shot script: adds the `platform` i18n namespace to all 5 message files."""
import json, pathlib, os

ROOT = pathlib.Path(__file__).parent.parent

EDITORIAL = {
    "playstation": (
        "PlayStation 4 and PS5 span everything from calm puzzle games to intense online multiplayer. "
        "Many great titles are available through PS Plus, but the subscription pressure and online exposure "
        "varies widely across the catalogue. LumiKin scores make it easy to find which PlayStation games are "
        "genuinely worth your child's time — and which ones come with hidden costs or engagement traps."
    ),
    "xbox": (
        "Xbox One and Xbox Series S|X are home to hundreds of titles available through Xbox Game Pass, "
        "making it one of the most accessible platforms for families. LumiKin scores help you navigate "
        "the catalog quickly — sorting by safest picks or family co-op highlights lets you build a trusted "
        "game list without playing every title yourself."
    ),
    "nintendo_switch": (
        "Nintendo Switch has one of the most family-friendly first-party libraries of any console, with "
        "beloved franchises like Mario, Zelda, and Pokémon consistently earning high benefit scores. "
        "The platform is also easy to manage with built-in parental controls and screen time limits. "
        "LumiKin scores help you find the standout third-party games worth adding to your collection."
    ),
    "ios": (
        "The App Store labels many games \"free\", but the real cost is often attention, in-app purchases, "
        "or intrusive ads. iOS games range from genuinely educational apps to highly optimized engagement "
        "loops. LumiKin scores flag monetization pressure and dopamine-trap mechanics so you can tell the "
        "difference before downloading."
    ),
    "android": (
        "Android gaming spans high-quality ports, indie gems, and heavily monetized free-to-play titles "
        "— often hard to tell apart from the Play Store listing alone. Google's content ratings cover "
        "subject matter, not design patterns. LumiKin scores go deeper, surfacing which games are built "
        "for benefit and which are built for maximum session length."
    ),
    "pc": (
        "PC gaming offers the widest catalogue of any platform, from calm educational puzzlers to massive "
        "online worlds. Steam family controls and library sharing features help, but the sheer volume makes "
        "curation difficult. LumiKin scores sort the catalogue by benefit-to-risk ratio so you can build "
        "a quality family library without trial and error."
    ),
}

DESC = {
    "playstation":    "LumiKin safety scores for PlayStation 4 and PlayStation 5 games.",
    "xbox":           "LumiKin safety scores for Xbox One, Xbox Series S and Series X games.",
    "nintendo_switch":"LumiKin safety scores for Nintendo Switch games.",
    "ios":            "LumiKin safety scores for iPhone and iPad games.",
    "android":        "LumiKin safety scores for Android games.",
    "pc":             "LumiKin safety scores for PC games on Steam, Epic Games, and more.",
}

UI = {
    "en": {
        "badge":             "Platform",
        "rated":             "rated",
        "browseAll":         "Browse all →",
        "noGames":           "No scored games yet for this platform. Check back soon.",
        "topRated":          "Top Rated",
        "safest":            "Safest Picks",
        "forKids":           "Best for Young Kids",
        "coop":              "Great Co-op",
        "recent":            "Recently Scored",
        "lowestRated":       "Lowest Rated",
        "scoreDistribution": "Score Distribution",
        "scoredSuffix":      "scored",
        "metaTitle":         "{name} Games for Kids — LumiKin",
        "metaDescription":   "Browse {count} rated {name} games for kids. Average LumiScore {avg}/100. Find safe {name} picks for your family on LumiKin.",
    },
    "sv": {
        "badge":             "Plattform",
        "rated":             "betygsatt",
        "browseAll":         "Bläddra alla →",
        "noGames":           "Inga betygsatta spel för den här plattformen ännu. Kolla tillbaka snart.",
        "topRated":          "Topprankade",
        "safest":            "Säkraste valen",
        "forKids":           "Bäst för yngre barn",
        "coop":              "Bra kooperativt spel",
        "recent":            "Nyligen betygsatt",
        "lowestRated":       "Lägst betyg",
        "scoreDistribution": "Poängfördelning",
        "scoredSuffix":      "betygsatta",
        "metaTitle":         "{name}-spel för barn — LumiKin",
        "metaDescription":   "Utforska {count} betygsatta {name}-spel för barn. Genomsnittligt LumiScore {avg}/100. Hitta säkra {name}-val för din familj på LumiKin.",
    },
    "de": {
        "badge":             "Plattform",
        "rated":             "bewertet",
        "browseAll":         "Alle ansehen →",
        "noGames":           "Noch keine bewerteten Spiele für diese Plattform. Schau bald wieder vorbei.",
        "topRated":          "Bestbewertet",
        "safest":            "Sicherste Auswahl",
        "forKids":           "Am besten für kleine Kinder",
        "coop":              "Großartig im Koop",
        "recent":            "Kürzlich bewertet",
        "lowestRated":       "Niedrigste Bewertung",
        "scoreDistribution": "Punkteverteilung",
        "scoredSuffix":      "bewertet",
        "metaTitle":         "{name}-Spiele für Kinder — LumiKin",
        "metaDescription":   "Entdecke {count} bewertete {name}-Spiele für Kinder. Durchschnittlicher LumiScore {avg}/100. Finde sichere {name}-Spiele für deine Familie auf LumiKin.",
    },
    "es": {
        "badge":             "Plataforma",
        "rated":             "calificados",
        "browseAll":         "Ver todos →",
        "noGames":           "Aún no hay juegos calificados para esta plataforma. Vuelve pronto.",
        "topRated":          "Mejor valorados",
        "safest":            "Opciones más seguras",
        "forKids":           "Mejor para niños pequeños",
        "coop":              "Genial en cooperativo",
        "recent":            "Recientemente calificados",
        "lowestRated":       "Peor valorados",
        "scoreDistribution": "Distribución de puntuaciones",
        "scoredSuffix":      "calificados",
        "metaTitle":         "Juegos de {name} para niños — LumiKin",
        "metaDescription":   "Explora {count} juegos de {name} calificados para niños. LumiScore promedio {avg}/100. Encuentra opciones seguras de {name} para tu familia en LumiKin.",
    },
    "fr": {
        "badge":             "Plateforme",
        "rated":             "notés",
        "browseAll":         "Voir tout →",
        "noGames":           "Aucun jeu noté pour cette plateforme pour l’instant. Revenez bientôt.",
        "topRated":          "Mieux notés",
        "safest":            "Choix les plus sûrs",
        "forKids":           "Idéal pour les jeunes enfants",
        "coop":              "Excellent en coopération",
        "recent":            "Récemment notés",
        "lowestRated":       "Moins bien notés",
        "scoreDistribution": "Distribution des scores",
        "scoredSuffix":      "notés",
        "metaTitle":         "Jeux {name} pour enfants — LumiKin",
        "metaDescription":   "Parcourez {count} jeux {name} notés pour enfants. LumiScore moyen {avg}/100. Trouvez des jeux {name} sûrs pour votre famille sur LumiKin.",
    },
}

for locale, ui_strings in UI.items():
    path = ROOT / "messages" / f"{locale}.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    ns = dict(ui_strings)

    # Descriptions — English placeholder in all locales for now
    for slug, text in DESC.items():
        ns[f"desc_{slug}"] = text

    # Editorial paragraphs — English placeholder in all locales for now
    for slug, text in EDITORIAL.items():
        ns[f"editorial_{slug}"] = text

    data["platform"] = ns

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"  {locale}.json updated ({len(ns)} keys in platform namespace)")

print("Done.")
